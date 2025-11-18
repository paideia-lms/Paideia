import { Container, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useEffect, useState } from "react";
import { href, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryDeleteAssignmentSubmission,
	tryGetAssignmentSubmissionById,
	tryGradeAssignmentSubmission,
} from "server/internal/assignment-submission-management";
import { tryFindGradebookItemByCourseModuleLink } from "server/internal/gradebook-item-management";
import { tryReleaseGrade } from "server/internal/user-grade-management";
import {
	canDeleteSubmissions,
	canSeeModuleSubmissions,
} from "server/utils/permissions";
import { GradingView } from "~/components/grading-view";
import {
	AssignmentBatchActions,
	AssignmentSubmissionTable,
	DiscussionSubmissionTable,
	QuizSubmissionTable,
} from "~/components/submission-tables";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { AssignmentActions } from "~/utils/module-actions";
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id.submissions";

// Define search params
export const submissionsSearchParams = {
	action: parseAsString,
	submissionId: parseAsInteger,
};

export const loadSearchParams = createLoader(submissionsSearchParams);

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Check if user can see submissions
	const canSee = canSeeModuleSubmissions(
		currentUser,
		enrolmentContext?.enrolment,
	).allowed;

	if (!canSee) {
		throw new ForbiddenResponse(
			"You don't have permission to view submissions",
		);
	}

	// Check if user can delete submissions
	const canDelete = canDeleteSubmissions(
		currentUser,
		enrolmentContext?.enrolment,
	).allowed;

	// Get all enrollments for this course to show all students, filter out students
	const enrollments = courseContext.course.enrollments.filter(
		(enrollment) => enrollment.role === "student",
	);

	// Parse search params to check if we're in grading mode
	const { action, submissionId } = loadSearchParams(request);

	const payload = context.get(globalContextKey).payload;

	// If we're in grading mode, fetch the submission
	let gradingSubmission = null;
	let gradingGrade = null;
	if (action === AssignmentActions.GRADE_SUBMISSION && submissionId) {
		const submissionResult = await tryGetAssignmentSubmissionById({
			payload,
			id: submissionId,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			req: request,
			overrideAccess: false,
		});

		if (!submissionResult.ok) {
			throw badRequest({ error: submissionResult.error.message });
		}

		const submission = submissionResult.value;

		// Verify the submission belongs to this module
		if (submission.courseModuleLink.id !== courseModuleContext.moduleLinkId) {
			throw new ForbiddenResponse("Submission does not belong to this module");
		}

		gradingSubmission = submission;

		// Get grade from submission itself (grades are now stored on submissions)
		const submissionWithGrade = submission as typeof submission & {
			grade?: number | null;
			feedback?: string | null;
		};
		if (
			submissionWithGrade.grade !== null &&
			submissionWithGrade.grade !== undefined
		) {
			// Try to get maxGrade from gradebook item
			let maxGrade: number | null = null;
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user: {
					...currentUser,
					avatar: currentUser.avatar?.id ?? undefined,
				},
				req: request,
				overrideAccess: false,
				courseModuleLinkId: courseModuleContext.moduleLinkId,
			});

			if (gradebookItemResult.ok) {
				maxGrade = gradebookItemResult.value.maxGrade ?? null;
			}

			gradingGrade = {
				baseGrade: submissionWithGrade.grade,
				maxGrade,
				feedback: submissionWithGrade.feedback || null,
			};
		}
	}

	// Fetch gradebook item to get maxGrade for all submissions
	let maxGrade: number | null = null;
	const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
		payload,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id ?? undefined,
		},
		req: request,
		overrideAccess: false,
		courseModuleLinkId: courseModuleContext.moduleLinkId,
	});

	if (gradebookItemResult.ok) {
		maxGrade = gradebookItemResult.value.maxGrade ?? null;
	}

	// Extract submissions from discriminated union based on module type
	const allSubmissions =
		courseModuleContext.submissions.type === "assignment" ||
		courseModuleContext.submissions.type === "quiz" ||
		courseModuleContext.submissions.type === "discussion"
			? courseModuleContext.submissions.submissions
			: [];

	// Map submissions with grades from submission.grade field
	const submissionsWithGrades = allSubmissions.map((submission) => {
		const submissionWithGrade = submission as typeof submission & {
			grade?: number | null;
			feedback?: string | null;
			gradedAt?: string | null;
		};
		return {
			...submission,
			grade:
				submissionWithGrade.grade !== null &&
				submissionWithGrade.grade !== undefined
					? {
							baseGrade: submissionWithGrade.grade,
							maxGrade,
							gradedAt: submissionWithGrade.gradedAt || null,
							feedback: submissionWithGrade.feedback || null,
						}
					: null,
		};
	});

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		course: courseContext.course,
		enrollments,
		submissions: submissionsWithGrades,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canDelete,
		gradingSubmission,
		gradingGrade,
		action,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const formData = await request.formData();
	const method = request.method;

	if (method === "DELETE") {
		assertRequestMethod(request.method, "DELETE");

		// Check if user can delete submissions
		const canDelete = canDeleteSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		).allowed;

		if (!canDelete) {
			return unauthorized({
				error: "You don't have permission to delete submissions",
			});
		}

		// Get submission ID from request
		const submissionId = formData.get("submissionId");

		if (!submissionId || typeof submissionId !== "string") {
			return badRequest({ error: "Submission ID is required" });
		}

		const id = Number.parseInt(submissionId, 10);
		if (Number.isNaN(id)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		// Delete the submission
		const deleteResult = await tryDeleteAssignmentSubmission({
			payload,
			id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			req: request,
			overrideAccess: false,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return { success: true };
	}

	if (method === "POST") {
		assertRequestMethod(request.method, "POST");

		// Check if user can grade submissions (same as viewing submissions)
		const canGrade = canSeeModuleSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		).allowed;

		if (!canGrade) {
			return unauthorized({
				error: "You don't have permission to grade submissions",
			});
		}

		// Get form data
		const submissionId = formData.get("submissionId");
		const score = formData.get("score");
		const feedback = formData.get("feedback");

		// Validate submission ID
		if (!submissionId || typeof submissionId !== "string") {
			return badRequest({ error: "Submission ID is required" });
		}

		const id = Number.parseInt(submissionId, 10);
		if (Number.isNaN(id)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		// Validate score
		if (!score || typeof score !== "string") {
			return badRequest({ error: "Score is required" });
		}

		const scoreValue = Number.parseFloat(score);
		if (Number.isNaN(scoreValue) || scoreValue < 0) {
			return badRequest({ error: "Invalid score value" });
		}

		// Grade the submission (only updates submission, doesn't create user-grade)
		const gradeResult = await tryGradeAssignmentSubmission({
			payload,
			request,
			id,
			grade: scoreValue,
			feedback: feedback && typeof feedback === "string" ? feedback : undefined,
			gradedBy: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!gradeResult.ok) {
			const errorMessage = String(gradeResult.error);
			return badRequest({ error: errorMessage });
		}

		return { success: true, submission: gradeResult.value };
	}

	if (method === "PUT") {
		assertRequestMethod(request.method, "PUT");

		// Check if user can grade submissions (same as viewing submissions)
		const canGrade = canSeeModuleSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		).allowed;

		if (!canGrade) {
			return unauthorized({
				error: "You don't have permission to release grades",
			});
		}

		// Get form data for release grade
		const courseModuleLinkId = formData.get("courseModuleLinkId");
		const enrollmentId = formData.get("enrollmentId");

		// Validate course module link ID
		if (!courseModuleLinkId || typeof courseModuleLinkId !== "string") {
			return badRequest({ error: "Course module link ID is required" });
		}

		const courseModuleLinkIdValue = Number.parseInt(courseModuleLinkId, 10);
		if (Number.isNaN(courseModuleLinkIdValue)) {
			return badRequest({ error: "Invalid course module link ID" });
		}

		// Validate enrollment ID
		if (!enrollmentId || typeof enrollmentId !== "string") {
			return badRequest({ error: "Enrollment ID is required" });
		}

		const enrollmentIdValue = Number.parseInt(enrollmentId, 10);
		if (Number.isNaN(enrollmentIdValue)) {
			return badRequest({ error: "Invalid enrollment ID" });
		}

		// Release the grade
		const releaseResult = await tryReleaseGrade({
			payload,
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id ?? null,
			},
			req: request,
			overrideAccess: false,
			courseActivityModuleLinkId: courseModuleLinkIdValue,
			enrollmentId: enrollmentIdValue,
		});

		if (!releaseResult.ok) {
			const errorMessage = String(releaseResult.error);
			return badRequest({ error: errorMessage });
		}

		return { success: true, released: true };
	}

	return badRequest({ error: "Unsupported method" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		"status" in actionData &&
		(actionData.status === StatusCode.BadRequest ||
			actionData.status === StatusCode.Unauthorized)
	) {
		const errorMessage =
			"error" in actionData && typeof actionData.error === "string"
				? actionData.error
				: "Failed to process request";
		notifications.show({
			title: "Error",
			message: errorMessage,
			color: "red",
		});
	} else if ("success" in actionData && actionData.success) {
		// Determine which action succeeded based on the request method
		// This will be handled by the specific hooks
	}

	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

// ============================================================================
// Types
// ============================================================================

type SubmissionType = {
	id: number;
	status: "draft" | "submitted" | "graded" | "returned";
	content?: string | null;
	submittedAt?: string | null;
	startedAt?: string | null;
	attemptNumber: number;
	attachments?: Array<{
		file:
			| number
			| {
					id: number;
					filename?: string | null;
					mimeType?: string | null;
					filesize?: number | null;
			  };
		description?: string;
	}> | null;
	grade?: {
		baseGrade: number | null;
		maxGrade: number | null;
		gradedAt?: string | null;
		feedback?: string | null;
	} | null;
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
};

type QuizSubmissionType = {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	attemptNumber: number;
	startedAt?: string | null;
	submittedAt?: string | null;
	timeSpent?: number | null;
	totalScore?: number | null;
	maxScore?: number | null;
	percentage?: number | null;
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
};

// ============================================================================
// Hooks
// ============================================================================

const useDeleteSubmission = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteSubmission = (submissionId: number, moduleLinkId: number) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());

		fetcher.submit(formData, {
			method: "DELETE",
			action: href("/course/module/:moduleLinkId/submissions", {
				moduleLinkId: moduleLinkId.toString(),
			}),
		});
	};

	return {
		deleteSubmission,
		isDeleting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useGradeSubmission = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const gradeSubmission = (
		submissionId: number,
		score: number,
		feedback?: string,
	) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("score", score.toString());
		if (feedback) {
			formData.append("feedback", feedback);
		}

		fetcher.submit(formData, {
			method: "POST",
		});
	};

	return {
		gradeSubmission,
		isGrading: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useReleaseGrade = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const releaseGrade = (courseModuleLinkId: number, enrollmentId: number) => {
		const formData = new FormData();
		formData.append("courseModuleLinkId", String(courseModuleLinkId));
		formData.append("enrollmentId", String(enrollmentId));
		fetcher.submit(formData, {
			method: "PUT",
		});
	};

	return {
		releaseGrade,
		isReleasing: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

// ============================================================================
// Main Component
// ============================================================================

export default function ModuleSubmissionsPage({
	loaderData,
}: Route.ComponentProps) {
	const {
		module,
		moduleLinkId,
		moduleSettings,
		course,
		enrollments,
		submissions,
		canDelete,
		gradingSubmission,
		action,
	} = loaderData;

	// Call hooks unconditionally at the top
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const { deleteSubmission } = useDeleteSubmission();
	const { releaseGrade, isReleasing, data: releaseData } = useReleaseGrade();

	// Show notification when grade is successfully released
	useEffect(() => {
		if (
			releaseData &&
			"success" in releaseData &&
			releaseData.success &&
			"released" in releaseData &&
			releaseData.released
		) {
			notifications.show({
				title: "Success",
				message: "Grade released successfully",
				color: "green",
			});
		}
	}, [releaseData]);

	// If we're in grading mode, show the grading view
	if (action === AssignmentActions.GRADE_SUBMISSION && gradingSubmission) {
		const submissionWithRelations =
			gradingSubmission as typeof gradingSubmission & {
				enrollment?: { id: number } | number | null;
				courseModuleLink?: { id: number } | number | null;
			};
		return (
			<GradingView
				submission={gradingSubmission}
				module={module}
				moduleSettings={moduleSettings}
				course={course}
				moduleLinkId={loaderData.moduleLinkId}
				grade={loaderData.gradingGrade}
				onReleaseGrade={releaseGrade}
				isReleasing={isReleasing}
				enrollment={submissionWithRelations.enrollment}
				courseModuleLink={submissionWithRelations.courseModuleLink}
			/>
		);
	}

	const title = `${moduleSettings?.settings.name ?? module.title} - ${module.type === "quiz" ? "Results" : "Submissions"} | ${course.title} | Paideia LMS`;

	const handleSelectRow = (enrollmentId: number, checked: boolean) => {
		setSelectedRows(
			checked
				? [...selectedRows, enrollmentId]
				: selectedRows.filter((id) => id !== enrollmentId),
		);
	};

	const handleClearSelection = () => {
		setSelectedRows([]);
	};

	// Render content based on module type
	const renderSubmissions = () => {
		if (module.type === "assignment") {
			const selectedEnrollments = enrollments.filter((e) =>
				selectedRows.includes(e.id),
			);

			return (
				<Stack gap="md">
					<AssignmentBatchActions
						selectedCount={selectedRows.length}
						selectedEnrollments={selectedEnrollments}
						onClearSelection={handleClearSelection}
					/>
					<AssignmentSubmissionTable
						courseId={course.id}
						enrollments={enrollments}
						submissions={submissions as SubmissionType[]}
						selectedRows={selectedRows}
						onSelectRow={handleSelectRow}
						canDelete={canDelete}
						onDeleteSubmission={(submissionId) =>
							deleteSubmission(submissionId, moduleLinkId)
						}
						moduleLinkId={moduleLinkId}
						onReleaseGrade={releaseGrade}
						isReleasing={isReleasing}
					/>
				</Stack>
			);
		}

		if (module.type === "quiz") {
			return (
				<QuizSubmissionTable
					courseId={course.id}
					enrollments={enrollments}
					submissions={submissions as QuizSubmissionType[]}
				/>
			);
		}

		if (module.type === "discussion") {
			return <DiscussionSubmissionTable />;
		}

		return null;
	};

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta name="description" content={`${module.title} submissions`} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={`${module.title} submissions`} />

			{renderSubmissions()}
		</Container>
	);
}
