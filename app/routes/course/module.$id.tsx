import {
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import {
	IconCalendar,
	IconChevronLeft,
	IconChevronRight,
	IconClock,
	IconInfoCircle,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useQueryState } from "nuqs";
import { createLoader, parseAsString } from "nuqs/server";
import prettyBytes from "pretty-bytes";
import { href, Link, redirect, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import type { CourseModuleContext } from "server/contexts/course-module-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateAssignmentSubmission,
	trySubmitAssignment,
	tryUpdateAssignmentSubmission,
} from "server/internal/assignment-submission-management";
import { tryCreateMedia } from "server/internal/media-management";
import {
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryListQuizSubmissions,
	tryStartQuizAttempt,
} from "server/internal/quiz-submission-management";
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import { canSubmitAssignment } from "server/utils/permissions";
import z from "zod";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import { DiscussionPreview } from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizInstructionsView } from "~/components/activity-modules-preview/quiz-instructions-view";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import { SubmissionHistory } from "~/components/submission-history";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
import { AssignmentActions, QuizActions } from "~/utils/module-actions";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import {
	BadRequestResponse,
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id";

const courseModuleSearchParams = {
	action: parseAsString.withDefault(""),
	showQuiz: parseAsString.withDefault(""),
};

export const loadSearchParams = createLoader(courseModuleSearchParams);

// Helper to format dates consistently on the server
const formatDateForDisplay = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

// Helper to format module settings with date strings
const formatModuleSettingsForDisplay = (
	moduleSettings: CourseModuleContext["moduleLinkSettings"],
) => {
	if (!moduleSettings?.settings) return null;

	const settings = moduleSettings.settings;
	const now = new Date();

	if (settings.type === "assignment") {
		return {
			type: "assignment" as const,
			name: settings.name,
			dates: [
				settings.allowSubmissionsFrom && {
					label: "Available from",
					value: formatDateForDisplay(settings.allowSubmissionsFrom),
					isOverdue: false,
				},
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "quiz") {
		return {
			type: "quiz" as const,
			name: settings.name,
			dates: [
				settings.openingTime && {
					label: "Opens",
					value: formatDateForDisplay(settings.openingTime),
					isOverdue: false,
				},
				settings.closingTime && {
					label: "Closes",
					value: formatDateForDisplay(settings.closingTime),
					isOverdue: new Date(settings.closingTime) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "discussion") {
		return {
			type: "discussion" as const,
			name: settings.name,
			dates: [
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	return null;
};

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const { action } = loadSearchParams(request);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const moduleLinkId = Number.parseInt(params.id, 10);
	if (Number.isNaN(moduleLinkId)) {
		throw new BadRequestResponse("Invalid module link ID");
	}

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get course module context
	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Get flattened list of modules from course structure
	const flattenedModules = flattenCourseStructureWithModuleInfo(
		courseContext.courseStructure,
	);

	// Find current module index
	const currentIndex = flattenedModules.findIndex(
		(m) => m.moduleLinkId === moduleLinkId,
	);

	// Get previous and next modules
	const previousModule =
		currentIndex > 0
			? {
				id: flattenedModules[currentIndex - 1].moduleLinkId,
				title: flattenedModules[currentIndex - 1].title,
				type: flattenedModules[currentIndex - 1].type,
			}
			: null;

	const nextModule =
		currentIndex < flattenedModules.length - 1 && currentIndex !== -1
			? {
				id: flattenedModules[currentIndex + 1].moduleLinkId,
				title: flattenedModules[currentIndex + 1].title,
				type: flattenedModules[currentIndex + 1].type,
			}
			: null;

	// Get current user's submissions for assignments
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can submit assignments
	const enrolmentContext = context.get(enrolmentContextKey);
	const canSubmit = canSubmitAssignment(enrolmentContext?.enrolment);

	if (!canSubmit && action === AssignmentActions.EDIT_SUBMISSION) {
		throw new ForbiddenResponse("You cannot edit submissions");
	}

	// Format module settings with dates for display
	const formattedModuleSettings = formatModuleSettingsForDisplay(
		courseModuleContext.moduleLinkSettings,
	);

	// If this is an assignment module and user cannot submit, they can't see submissions
	if (courseModuleContext.module.type === "assignment" && !canSubmit) {
		return {
			module: courseModuleContext.module,
			moduleSettings: courseModuleContext.moduleLinkSettings,
			formattedModuleSettings,
			course: courseContext.course,
			previousModule,
			nextModule,
			userSubmission: null,
			userSubmissions: [],
			moduleLinkId: courseModuleContext.moduleLinkId,
			canSubmit: false,
		};
	}

	// For quizzes, fetch student's submissions separately because students
	// don't have permission to see all submissions from course module context
	let userSubmissions: typeof courseModuleContext.submissions = [];

	if (courseModuleContext.module.type === "quiz") {
		const payload = context.get(globalContextKey)?.payload;
		if (!payload) {
			throw new ForbiddenResponse("Payload not available");
		}


		// Fetch only the current student's quiz submissions
		const quizSubmissionsResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			limit: 1000,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (quizSubmissionsResult.ok) {
			// Map quiz submissions to match the expected type structure
			// The submissions from tryListQuizSubmissions already have the correct structure
			userSubmissions = quizSubmissionsResult.value.docs as typeof courseModuleContext.submissions;
		}
	} else if (courseModuleContext.module.type === "assignment") {
		// For assignments, filter from course module context (admins can see all)
		userSubmissions = courseModuleContext.submissions.filter(
			(sub) => "student" in sub && sub.student.id === currentUser.id,
		);
	}

	// Get the latest submission (draft or most recent for assignments, in_progress or most recent for quizzes)
	const userSubmission =
		userSubmissions.length > 0
			? courseModuleContext.module.type === "assignment"
				? userSubmissions.find(
					(sub) =>
						"status" in sub && sub.status === "draft",
				) || userSubmissions[0]
				: courseModuleContext.module.type === "quiz"
					? // For quizzes, prioritize in_progress, then most recent
					userSubmissions.find(
						(sub) =>
							"status" in sub &&
							sub.status === "in_progress",
					) ||
					// Sort by createdAt descending and get the most recent
					[...userSubmissions].sort((a, b) => {
						const aDate =
							"createdAt" in a && typeof a.createdAt === "string"
								? new Date(a.createdAt).getTime()
								: 0;
						const bDate =
							"createdAt" in b && typeof b.createdAt === "string"
								? new Date(b.createdAt).getTime()
								: 0;
						return bDate - aDate;
					})[0]
					: null
			: null;

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		formattedModuleSettings,
		course: courseContext.course,
		previousModule,
		nextModule,
		userSubmission,
		userSubmissions,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canSubmit,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	if (!courseModuleContext) {
		return badRequest({ error: "Module not found" });
	}

	if (!enrolmentContext?.enrolment) {
		return badRequest({ error: "Enrollment not found" });
	}

	const moduleLinkId = Number.parseInt(params.id, 10);
	if (Number.isNaN(moduleLinkId)) {
		return badRequest({ error: "Invalid module link ID" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if this is a quiz start attempt action
	const { action: actionParam } = loadSearchParams(request);
	const isQuizStart =
		courseModuleContext.module.type === "quiz" &&
		actionParam === QuizActions.START_ATTEMPT;

	// Only students can submit assignments or start quizzes
	if (!canSubmitAssignment(enrolmentContext.enrolment)) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

	// Handle quiz start attempt
	if (isQuizStart) {
		// Check if there's already an in_progress submission
		const checkResult = await tryCheckInProgressSubmission({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!checkResult.ok) {
			return badRequest({ error: checkResult.error.message });
		}

		// If there's an in_progress submission, reuse it by redirecting with showQuiz parameter
		if (checkResult.value.hasInProgress) {
			return redirect(
				href("/course/module/:id", {
					id: moduleLinkId.toString(),
				}) + "?showQuiz=true",
			);
		}

		// No in_progress attempt exists, create a new one
		// Get next attempt number
		const nextAttemptResult = await tryGetNextAttemptNumber({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!nextAttemptResult.ok) {
			return badRequest({ error: nextAttemptResult.error.message });
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			attemptNumber: nextAttemptResult.value,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!startResult.ok) {
			return badRequest({ error: startResult.error.message });
		}

		// Redirect with showQuiz parameter to show the quiz preview
		return redirect(
			href("/course/module/:id", {
				id: moduleLinkId.toString(),
			}) + "?showQuiz=true",
		);
	}

	// Handle assignment submission (existing logic)
	if (courseModuleContext.module.type !== "assignment") {
		return badRequest({ error: "Invalid module type for this action" });
	}

	// Begin transaction for file uploads and submission
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			error: "Failed to begin transaction",
		});
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		const uploadedFileIds: number[] = [];

		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "files") {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				const mediaResult = await tryCreateMedia({
					payload,
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: `Assignment submission file - ${fileUpload.name}`,
					userId: currentUser.id,
					user: {
						...currentUser,
						collection: "users",
						avatar: currentUser.avatar?.id ?? undefined,
					},
					req: { transactionID },
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				const fileId = mediaResult.value.media.id;
				uploadedFileIds.push(fileId);
				return fileId;
			}
		};

		const formData = await parseFormDataWithFallback(
			request,
			uploadHandler as FileUploadHandler,
			maxFileSize !== undefined ? { maxFileSize } : undefined,
		);

		const parsed = z
			.object({
				textContent: z.string().nullish(),
			})
			.safeParse({
				textContent: formData.get("textContent"),
			});

		if (!parsed.success) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				error: parsed.error.message,
			});
		}

		const textContent = parsed.data.textContent || "";

		// Build attachments array from uploaded files
		const attachments = uploadedFileIds.map((fileId) => ({
			file: fileId,
		}));

		// Find existing draft submission
		const existingDraftSubmission = courseModuleContext.submissions.find(
			(sub) =>
				"student" in sub &&
				sub.student.id === currentUser.id &&
				sub.status === "draft",
		);

		// Calculate next attempt number
		const userSubmissions = courseModuleContext.submissions.filter(
			(sub): sub is typeof sub & { attemptNumber: unknown } =>
				"student" in sub &&
				sub.student.id === currentUser.id &&
				"attemptNumber" in sub,
		);
		const maxAttemptNumber =
			userSubmissions.length > 0
				? Math.max(...userSubmissions.map((sub) => sub.attemptNumber as number))
				: 0;
		const nextAttemptNumber =
			existingDraftSubmission && "attemptNumber" in existingDraftSubmission
				? (existingDraftSubmission.attemptNumber as number)
				: maxAttemptNumber + 1;

		let submissionId: number;

		if (existingDraftSubmission) {
			// Update existing draft submission
			const updateResult = await tryUpdateAssignmentSubmission(payload, {
				id: existingDraftSubmission.id,
				content: textContent,
				attachments: attachments.length > 0 ? attachments : undefined,
				status: "draft",
				transactionID,
			});

			if (!updateResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: updateResult.error.message });
			}

			submissionId = existingDraftSubmission.id;
		} else {
			// Create new submission with next attempt number
			const createResult = await tryCreateAssignmentSubmission(payload, {
				courseModuleLinkId: moduleLinkId,
				studentId: currentUser.id,
				enrollmentId: enrolmentContext.enrolment.id,
				content: textContent,
				attachments: attachments.length > 0 ? attachments : undefined,
				attemptNumber: nextAttemptNumber,
				transactionID,
			});

			if (!createResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: createResult.error.message });
			}

			submissionId = createResult.value.id;
		}

		// Submit the assignment (change status to submitted)
		const submitResult = await trySubmitAssignment(
			payload,
			submissionId,
			transactionID.toString(),
		);

		if (!submitResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: submitResult.error.message });
		}

		await payload.db.commitTransaction(transactionID);

		return redirect(
			href("/course/module/:id", { id: moduleLinkId.toString() }),
		);
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Assignment submission error:", error);

		// Handle file size and count limit errors
		if (error instanceof MaxFileSizeExceededError) {
			return badRequest({
				error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
			});
		}

		if (error instanceof MaxFilesExceededError) {
			return badRequest({
				error: error.message,
			});
		}

		return badRequest({
			error:
				error instanceof Error ? error.message : "Failed to submit assignment",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData &&
		"status" in actionData &&
		(actionData.status === StatusCode.BadRequest ||
			actionData.status === StatusCode.Unauthorized)
	) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: "Failed to complete operation",
			color: "red",
		});
	}
	// Success case - redirect will happen automatically for quiz start and assignment submission

	return actionData;
}

const useSubmitAssignment = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const submitAssignment = (textContent: string, files: File[]) => {
		const formData = new FormData();
		formData.append("textContent", textContent);

		// Add all files to form data
		for (const file of files) {
			formData.append("files", file);
		}

		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
		});
	};

	return {
		submitAssignment,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

const useStartQuizAttempt = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const startQuizAttempt = () => {
		const formData = new FormData();
		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:id", {
				id: moduleLinkId.toString(),
			}) + `?action=${QuizActions.START_ATTEMPT}`,
		});
	};

	return {
		startQuizAttempt,
		isStarting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

// Component to display module dates/times
function ModuleDatesInfo({
	moduleSettings,
}: {
	moduleSettings: Route.ComponentProps["loaderData"]["formattedModuleSettings"];
}) {
	if (!moduleSettings || moduleSettings.dates.length === 0) return null;

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Group gap="xs">
					<IconInfoCircle size={20} />
					<Title order={5}>Important Dates</Title>
				</Group>

				<Stack gap="xs">
					{moduleSettings.dates.map((dateInfo) => (
						<Group gap="xs" key={dateInfo.label}>
							{dateInfo.label.includes("Opens") ||
								dateInfo.label.includes("Available") ? (
								<IconCalendar size={16} />
							) : (
								<IconClock size={16} />
							)}
							<Text
								size="sm"
								fw={500}
								c={dateInfo.isOverdue ? "red" : undefined}
							>
								{dateInfo.label}:
							</Text>
							<Text size="sm" c={dateInfo.isOverdue ? "red" : undefined}>
								{dateInfo.value}
								{dateInfo.isOverdue &&
									(dateInfo.label.includes("Closes") ||
										dateInfo.label.includes("deadline")
										? " (Closed)"
										: " (Overdue)")}
							</Text>
						</Group>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const {
		module,
		moduleSettings,
		formattedModuleSettings,
		course,
		previousModule,
		nextModule,
		userSubmission,
		userSubmissions,
		canSubmit,
	} = loaderData;
	const { submitAssignment, isSubmitting } = useSubmitAssignment();
	const { startQuizAttempt } = useStartQuizAttempt(loaderData.moduleLinkId);
	const [showQuiz] = useQueryState(
		"showQuiz",
		parseAsString.withDefault(""),
	);

	// Handle different module types
	const renderModuleContent = () => {
		switch (module.type) {
			case "page": {
				const pageContent = module.page?.content || null;
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<PagePreview
							content={pageContent || "<p>No content available</p>"}
						/>
					</>
				);
			}
			case "assignment": {
				// Type guard to ensure we have an assignment submission
				const assignmentSubmission =
					userSubmission &&
						"content" in userSubmission &&
						"attachments" in userSubmission
						? {
							id: userSubmission.id,
							status: userSubmission.status as
								| "draft"
								| "submitted"
								| "graded"
								| "returned",
							content: (userSubmission.content as string) || null,
							attachments: userSubmission.attachments
								? userSubmission.attachments.map((att) => ({
									file:
										typeof att.file === "object" &&
											att.file !== null &&
											"id" in att.file
											? att.file.id
											: Number(att.file),
									description: att.description as string | undefined,
								}))
								: null,
							submittedAt: ("submittedAt" in userSubmission
								? userSubmission.submittedAt
								: null) as string | null,
							attemptNumber: ("attemptNumber" in userSubmission
								? userSubmission.attemptNumber
								: 1) as number,
						}
						: null;

				// Map all submissions for display - filter assignment submissions only
				const allSubmissionsForDisplay = userSubmissions
					.filter(
						(
							sub,
						): sub is typeof sub & {
							content: unknown;
							attemptNumber: unknown;
						} => "content" in sub && "attemptNumber" in sub,
					)
					.map((sub) => ({
						id: sub.id,
						status: sub.status as "draft" | "submitted" | "graded" | "returned",
						content: (sub.content as string) || null,
						submittedAt: ("submittedAt" in sub ? sub.submittedAt : null) as
							| string
							| null,
						attemptNumber: (sub.attemptNumber as number) || 1,
						attachments:
							"attachments" in sub && sub.attachments
								? (sub.attachments as Array<{
									file: number | { id: number; filename: string };
									description?: string;
								}>)
								: null,
					}));

				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<AssignmentPreview
							assignment={module.assignment || null}
							submission={assignmentSubmission}
							allSubmissions={allSubmissionsForDisplay}
							onSubmit={({ textContent, files }) => {
								submitAssignment(textContent, files);
							}}
							isSubmitting={isSubmitting}
							canSubmit={canSubmit}
						/>
						{allSubmissionsForDisplay.length > 0 && (
							<SubmissionHistory
								submissions={allSubmissionsForDisplay}
								variant="compact"
							/>
						)}
					</>
				);
			}
			case "quiz": {
				const quizConfig = module.quiz?.rawQuizConfig || null;
				if (!quizConfig) {
					return <Text c="red">No quiz configuration available</Text>;
				}

				// Filter quiz submissions
				const quizSubmissions = userSubmissions.filter(
					(sub): sub is typeof sub & { attemptNumber: unknown; status: unknown } =>
						"attemptNumber" in sub && "status" in sub,
				);

				// Check if there's an active in_progress attempt
				const hasActiveAttempt = quizSubmissions.some(
					(sub) => sub.status === "in_progress",
				);

				// Map all quiz submissions for display
				const allQuizSubmissionsForDisplay = quizSubmissions.map((sub) => ({
					id: sub.id,
					status: sub.status as
						| "in_progress"
						| "completed"
						| "graded"
						| "returned",
					submittedAt: ("submittedAt" in sub ? sub.submittedAt : null) as
						| string
						| null,
					startedAt: ("startedAt" in sub ? sub.startedAt : null) as
						| string
						| null,
					attemptNumber: (sub.attemptNumber as number) || 1,
				}));

				// Show QuizPreview only if showQuiz parameter is true AND there's an active attempt
				if (showQuiz === "true" && hasActiveAttempt) {
					return (
						<>
							<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
							<QuizPreview quizConfig={quizConfig} />
						</>
					);
				}

				// Always show instructions view with start button
				// The start button will either reuse existing in_progress attempt or create new one
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<QuizInstructionsView
							quiz={module.quiz}
							allSubmissions={allQuizSubmissionsForDisplay}
							onStartQuiz={startQuizAttempt}
							canSubmit={canSubmit}
						/>
						{allQuizSubmissionsForDisplay.length > 0 && (
							<SubmissionHistory
								submissions={allQuizSubmissionsForDisplay.map((sub) => ({
									id: sub.id,
									status:
										sub.status === "in_progress"
											? "draft"
											: sub.status === "completed"
												? "submitted"
												: sub.status === "graded"
													? "graded"
													: "returned",
									submittedAt: sub.submittedAt,
									startedAt: sub.startedAt,
									attemptNumber: sub.attemptNumber,
								}))}
								variant="compact"
							/>
						)}
					</>
				);
			}
			case "discussion":
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<DiscussionPreview discussion={module.discussion || null} />
					</>
				);
			case "whiteboard": {
				const whiteboardContent = module.whiteboard?.content || null;
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<WhiteboardPreview content={whiteboardContent || "{}"} />
					</>
				);
			}
			default:
				return <Text c="red">Unknown module type: {module.type}</Text>;
		}
	};

	const title = `${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`View ${module.title} in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`View ${module.title} in ${course.title}`}
			/>

			<Stack gap="xl">
				{renderModuleContent()}

				{/* Navigation buttons */}
				<Group justify="space-between">
					{previousModule ? (
						<Button
							component={Link}
							to={href("/course/module/:id", {
								id: previousModule.id.toString(),
							})}
							leftSection={<IconChevronLeft size={16} />}
							variant="light"
						>
							Previous: {previousModule.title}
						</Button>
					) : (
						<div />
					)}
					{nextModule ? (
						<Button
							component={Link}
							to={href("/course/module/:id", {
								id: nextModule.id.toString(),
							})}
							rightSection={<IconChevronRight size={16} />}
							variant="light"
						>
							Next: {nextModule.title}
						</Button>
					) : (
						<div />
					)}
				</Group>
			</Stack>
		</Container>
	);
}
