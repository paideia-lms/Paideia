import {
	Button,
	Container,
	Group,
	Stack,
	Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { href, Link, redirect, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
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
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import { canSubmitAssignment } from "server/utils/permissions";
import { assertRequestMethod } from "~/utils/assert-request-method";
import z from "zod";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import { DiscussionPreview } from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import {
	badRequest,
	BadRequestResponse,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { ContentType } from "~/utils/get-content-type";
import type { Route } from "./+types/module.$id";
import { createLoader, parseAsString } from "nuqs/server";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { AssignmentActions } from "~/utils/module-actions";

const courseModuleSearchParams = {
	action: parseAsString.withDefault(""),
}

export const loadSearchParams = createLoader(courseModuleSearchParams);

export const loader = async ({ context, params, request }: Route.LoaderArgs) => {
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
	const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can submit assignments
	const enrolmentContext = context.get(enrolmentContextKey);
	const canSubmit = canSubmitAssignment(enrolmentContext?.enrolment);

	if (!canSubmit && action === AssignmentActions.EDIT_SUBMISSION) {
		throw new ForbiddenResponse("You cannot edit submissions");
	}

	// If this is an assignment module and user cannot submit, they can't see submissions
	if (courseModuleContext.module.type === "assignment" && !canSubmit) {
		return {
			module: courseModuleContext.module,
			moduleSettings: courseModuleContext.moduleLinkSettings,
			course: courseContext.course,
			previousModule,
			nextModule,
			userSubmission: null,
			userSubmissions: [],
			moduleLinkId: courseModuleContext.moduleLinkId,
			canSubmit: false,
		};
	}

	const userSubmissions = courseModuleContext.module.type === "assignment"
		? courseModuleContext.submissions.filter(
			(sub) => "student" in sub && sub.student.id === currentUser.id
		)
		: [];

	// Get the latest submission (draft or most recent)
	const userSubmission = userSubmissions.length > 0
		? userSubmissions.find(sub => sub.status === "draft") || userSubmissions[0]
		: null;

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		course: courseContext.course,
		previousModule,
		nextModule,
		userSubmission,
		userSubmissions,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canSubmit,
	};
};

export const action = async ({ request, context, params }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
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

	// Only students can submit assignments
	if (!canSubmitAssignment(enrolmentContext.enrolment)) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

	const moduleLinkId = Number.parseInt(params.id, 10);
	if (Number.isNaN(moduleLinkId)) {
		return badRequest({ error: "Invalid module link ID" });
	}

	const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

	// Begin transaction for file uploads and submission
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			error: "Failed to begin transaction",
		});
	}

	try {
		const uploadedFileIds: number[] = [];

		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "files") {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				const mediaResult = await tryCreateMedia(payload, {
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: `Assignment submission file - ${fileUpload.name}`,
					userId: currentUser.id,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				const fileId = mediaResult.value.media.id;
				uploadedFileIds.push(fileId);
				return fileId;
			}
		};

		const formData = await parseFormData(
			request,
			uploadHandler as FileUploadHandler,
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
		const submitResult = await trySubmitAssignment(payload, submissionId, transactionID.toString());

		if (!submitResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: submitResult.error.message });
		}

		await payload.db.commitTransaction(transactionID);

		return redirect(href("/course/module/:id", { id: moduleLinkId.toString() }));
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Assignment submission error:", error);
		return badRequest({
			error:
				error instanceof Error ? error.message : "Failed to submit assignment",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest || actionData?.status === StatusCode.Unauthorized) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: "Failed to submit assignment",
			color: "red",
		});
	} else {
		// Success case - redirect will happen automatically
		notifications.show({
			title: "Success",
			message: "Assignment submitted successfully",
			color: "green",
		});
	}

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

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const { module, moduleSettings, course, previousModule, nextModule, userSubmission, userSubmissions, canSubmit } = loaderData;
	const { submitAssignment, isSubmitting } = useSubmitAssignment();

	// Handle different module types
	const renderModuleContent = () => {
		switch (module.type) {
			case "page": {
				const pageContent = module.page?.content || null;
				return (
					<PagePreview content={pageContent || "<p>No content available</p>"} />
				);
			}
			case "assignment": {
				// Type guard to ensure we have an assignment submission
				const assignmentSubmission = userSubmission && "content" in userSubmission && "attachments" in userSubmission
					? {
						id: userSubmission.id,
						status: userSubmission.status as "draft" | "submitted" | "graded" | "returned",
						content: (userSubmission.content as string) || null,
						attachments: userSubmission.attachments ? userSubmission.attachments.map((att) => ({
							file: typeof att.file === "object" && att.file !== null && "id" in att.file ? att.file.id : Number(att.file),
							description: att.description as string | undefined,
						})) : null,
						submittedAt: ("submittedAt" in userSubmission ? userSubmission.submittedAt : null) as string | null,
						attemptNumber: ("attemptNumber" in userSubmission ? userSubmission.attemptNumber : 1) as number,
					}
					: null;

				// Map all submissions for display - filter assignment submissions only
				const allSubmissionsForDisplay = userSubmissions
					.filter((sub): sub is typeof sub & { content: unknown; attemptNumber: unknown } =>
						"content" in sub && "attemptNumber" in sub
					)
					.map((sub) => ({
						id: sub.id,
						status: sub.status as "draft" | "submitted" | "graded" | "returned",
						content: (sub.content as string) || null,
						submittedAt: ("submittedAt" in sub ? sub.submittedAt : null) as string | null,
						attemptNumber: (sub.attemptNumber as number) || 1,
						attachments: ("attachments" in sub && sub.attachments)
							? (sub.attachments as Array<{ file: number | { id: number; filename: string }; description?: string }>)
							: null,
					}));

				return (
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
				);
			}
			case "quiz": {
				const quizConfig = module.quiz?.rawQuizConfig || null;
				if (!quizConfig) {
					return <Text c="red">No quiz configuration available</Text>;
				}
				return <QuizPreview quizConfig={quizConfig} />;
			}
			case "discussion":
				return <DiscussionPreview discussion={module.discussion || null} />;
			case "whiteboard": {
				const whiteboardContent = module.whiteboard?.content || null;
				return <WhiteboardPreview content={whiteboardContent || "{}"} />;
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
