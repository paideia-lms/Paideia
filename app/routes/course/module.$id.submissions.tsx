import { Container, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useState } from "react";
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
import { tryGradeDiscussionSubmission } from "server/internal/discussion-management";
import { tryFindGradebookItemByCourseModuleLink } from "server/internal/gradebook-item-management";
import {
	tryGetQuizSubmissionById,
	tryGradeQuizSubmission,
} from "server/internal/quiz-submission-management";
import {
	tryReleaseAssignmentGrade,
	tryReleaseDiscussionGrade,
	tryReleaseQuizGrade,
} from "server/internal/user-grade-management";
import {
	canDeleteSubmissions,
	canSeeModuleSubmissions,
} from "server/utils/permissions";
import { DiscussionGradingView } from "~/components/discussion-grading-view";
import { AssignmentGradingView } from "~/components/grading-view";
import { QuizGradingView } from "~/components/quiz-grading-view";
import {
	AssignmentBatchActions,
	AssignmentSubmissionTable,
	DiscussionSubmissionTable,
	QuizSubmissionTable,
} from "~/components/submission-tables";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { AssignmentActions, QuizActions } from "~/utils/module-actions";
import {
	badRequest,
	ForbiddenResponse,
	ok,
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
	let gradingModuleType: "assignment" | "quiz" | "discussion" | null = null;

	if (
		(action === AssignmentActions.GRADE_SUBMISSION ||
			action === QuizActions.GRADE_SUBMISSION) &&
		submissionId
	) {
		// Determine module type from context
		const moduleType = courseModuleContext.type;

		if (moduleType === "assignment") {
			const submissionResult = await tryGetAssignmentSubmissionById({
				payload,
				id: submissionId,
				user: currentUser,
				req: request,
				overrideAccess: false,
			});

			if (!submissionResult.ok) {
				throw badRequest({ error: submissionResult.error.message });
			}

			const submission = submissionResult.value;

			// Verify the submission belongs to this module
			if (submission.courseModuleLink.id !== courseModuleContext.id) {
				throw new ForbiddenResponse(
					"Submission does not belong to this module",
				);
			}

			gradingSubmission = submission;
			gradingModuleType = "assignment";

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
				const gradebookItemResult =
					await tryFindGradebookItemByCourseModuleLink({
						payload,
						user: currentUser,
						req: request,
						overrideAccess: false,
						courseModuleLinkId: courseModuleContext.id,
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
		} else if (moduleType === "quiz") {
			const submissionResult = await tryGetQuizSubmissionById({
				payload,
				id: submissionId,
				user: currentUser,
				req: request,
				overrideAccess: false,
			});

			if (!submissionResult.ok) {
				throw badRequest({ error: submissionResult.error.message });
			}

			const submission = submissionResult.value;

			// Verify the submission belongs to this module
			if (submission.courseModuleLink !== courseModuleContext.id) {
				throw new ForbiddenResponse(
					"Submission does not belong to this module",
				);
			}

			gradingSubmission = submission;
			gradingModuleType = "quiz";

			// Get grade from submission itself
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
				const gradebookItemResult =
					await tryFindGradebookItemByCourseModuleLink({
						payload,
						user: currentUser,
						req: request,
						overrideAccess: false,
						courseModuleLinkId: courseModuleContext.id,
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
		} else if (moduleType === "discussion") {
			if (courseModuleContext.type !== "discussion") {
				throw badRequest({ error: "Module type mismatch" });
			}
			const allSubmissions = courseModuleContext.submissions;
			const submission = allSubmissions.find(
				(sub: { id: number }) => sub.id === submissionId,
			);

			if (!submission) {
				throw badRequest({
					error: `Discussion submission with id '${submissionId}' not found`,
				});
			}

			gradingSubmission = submission;
			gradingModuleType = "discussion";

			// Get student ID from submission
			const studentId = submission.student.id;

			// Build a map of ALL submissions by ID for parent lookup (needed because parent might be from another student)
			const allSubmissionsMap = new Map(
				allSubmissions.map((sub) => {
					const subWithGrade = sub as typeof sub & {
						grade?: number | null;
						feedback?: string | null;
						gradedAt?: string | null;
					};
					const subWithParent = sub as typeof sub & {
						parentThread?: number | { id: number } | null;
					};
					const parentThreadId =
						typeof subWithParent.parentThread === "object" &&
							subWithParent.parentThread !== null
							? subWithParent.parentThread.id
							: typeof subWithParent.parentThread === "number"
								? subWithParent.parentThread
								: null;

					// Extract student/author information
					const student = sub.student;
					const author =
						typeof student === "object" && student !== null
							? {
								id: student.id,
								firstName: student.firstName ?? null,
								lastName: student.lastName ?? null,
								email: student.email ?? null,
								avatar: student.avatar ?? null,
							}
							: null;

					return [
						sub.id,
						{
							id: sub.id,
							status: sub.status,
							postType: sub.postType,
							title: sub.title ?? null,
							content: sub.content,
							publishedAt: sub.publishedAt ?? null,
							createdAt: sub.createdAt,
							grade: subWithGrade.grade ?? null,
							feedback: subWithGrade.feedback ?? null,
							gradedAt: subWithGrade.gradedAt ?? null,
							parentThread: parentThreadId,
							author,
						},
					];
				}),
			);

			// Filter all discussion submissions for this student from context
			const studentSubmissions = allSubmissions
				.filter((sub) => sub.student.id === studentId)
				.map((sub) => {
					const subWithGrade = sub as typeof sub & {
						grade?: number | null;
						feedback?: string | null;
						gradedAt?: string | null;
					};
					const subWithParent = sub as typeof sub & {
						parentThread?: number | { id: number } | null;
					};
					const parentThreadId =
						typeof subWithParent.parentThread === "object" &&
							subWithParent.parentThread !== null
							? subWithParent.parentThread.id
							: typeof subWithParent.parentThread === "number"
								? subWithParent.parentThread
								: null;
					return {
						id: sub.id,
						status: sub.status,
						postType: sub.postType,
						title: sub.title ?? null,
						content: sub.content,
						publishedAt: sub.publishedAt ?? null,
						createdAt: sub.createdAt,
						grade: subWithGrade.grade ?? null,
						feedback: subWithGrade.feedback ?? null,
						gradedAt: subWithGrade.gradedAt ?? null,
						parentThread: parentThreadId,
					};
				});

			// Add parentPost and ancestors references to each submission
			const studentSubmissionsWithParents = studentSubmissions.map((sub) => {
				const parentPost =
					sub.parentThread && sub.postType !== "thread"
						? (allSubmissionsMap.get(sub.parentThread) ?? null)
						: null;

				// Build ancestors chain (all parents up to thread)
				const ancestors: (typeof sub)[] = [];
				if (parentPost) {
					let current: typeof sub | null = parentPost;
					while (current) {
						ancestors.push(current);
						// Stop at thread (root)
						if (current.postType === "thread") {
							break;
						}
						// Get next parent
						if (current.parentThread) {
							current = allSubmissionsMap.get(current.parentThread) ?? null;
						} else {
							current = null;
						}
					}
					// Reverse to show from thread to direct parent
					ancestors.reverse();
				}

				return {
					...sub,
					parentPost,
					ancestors,
				};
			});

			// Get grade from submission itself
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
				const gradebookItemResult =
					await tryFindGradebookItemByCourseModuleLink({
						payload,
						user: currentUser,
						req: request,
						overrideAccess: false,
						courseModuleLinkId: courseModuleContext.id,
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

			// Add student submissions to gradingSubmission for display
			gradingSubmission = {
				...gradingSubmission,
				studentSubmissions: studentSubmissionsWithParents,
			};
		}
	}

	// Fetch gradebook item to get maxGrade for all submissions
	let maxGrade: number | null = null;
	const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
		payload,
		user: currentUser,
		req: request,
		overrideAccess: false,
		courseModuleLinkId: courseModuleContext.id,
	});

	if (gradebookItemResult.ok) {
		maxGrade = gradebookItemResult.value.maxGrade ?? null;
	}

	// Extract submissions from context based on module type
	const allSubmissions =
		courseModuleContext.type === "assignment" ||
			courseModuleContext.type === "quiz" ||
			courseModuleContext.type === "discussion"
			? courseModuleContext.submissions
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

	// Wrap settings back to match what grading views expect
	const moduleSettings = courseModuleContext.settings
		? {
			version: "v2" as const,
			settings: courseModuleContext.settings,
		}
		: null;

	return {
		module: courseModuleContext.activityModule,
		moduleSettings,
		course: courseContext.course,
		enrollments,
		submissions: submissionsWithGrades,
		moduleLinkId: courseModuleContext.id,
		canDelete,
		gradingSubmission,
		gradingGrade,
		gradingModuleType,
		action,
		maxGrade,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	if (!courseModuleContext) {
		return badRequest({ error: "Module not found" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const formData = await request.formData();
	const method = request.method;
	const moduleType = courseModuleContext.type;

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
			user: currentUser,
			req: request,
			overrideAccess: false,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Submission deleted successfully" });
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

		// Grade the submission based on module type
		if (moduleType === "assignment") {
			const gradeResult = await tryGradeAssignmentSubmission({
				payload,
				req: request,
				id,
				grade: scoreValue,
				feedback:
					feedback && typeof feedback === "string" ? feedback : undefined,
				gradedBy: currentUser.id,
				user: currentUser,
				overrideAccess: false,
			});

			if (!gradeResult.ok) {
				const errorMessage = String(gradeResult.error);
				return badRequest({ error: errorMessage });
			}

			return ok({
				success: true,
				submission: gradeResult.value,
				message: "Submission graded successfully",
			});
		} else if (moduleType === "quiz") {
			// For quiz, we need to get the submission first to get enrollment and gradebook item
			const submissionResult = await tryGetQuizSubmissionById({
				payload,
				id,
				user: currentUser,
				req: request,
				overrideAccess: false,
			});

			if (!submissionResult.ok) {
				return badRequest({ error: submissionResult.error.message });
			}

			const submission = submissionResult.value;
			const enrollmentId =
				typeof submission.enrollment === "object"
					? submission.enrollment.id
					: submission.enrollment;

			// Get gradebook item
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user: currentUser,
				req: request,
				overrideAccess: false,
				courseModuleLinkId: courseModuleContext.id,
			});

			if (!gradebookItemResult.ok) {
				return badRequest({ error: "Gradebook item not found" });
			}

			const gradebookItemId = gradebookItemResult.value.id;

			// Grade the quiz submission
			const gradeResult = await tryGradeQuizSubmission({
				payload,
				req: request,
				id,
				enrollmentId,
				gradebookItemId,
				gradedBy: currentUser.id,
			});

			if (!gradeResult.ok) {
				const errorMessage = String(gradeResult.error);
				return badRequest({ error: errorMessage });
			}

			return ok({
				success: true,
				submission: gradeResult.value,
				message: "Quiz submission graded successfully",
			});
		} else if (moduleType === "discussion") {
			// Grade the discussion submission
			const gradeResult = await tryGradeDiscussionSubmission({
				payload,
				req: request,
				id,
				grade: scoreValue,
				feedback:
					feedback && typeof feedback === "string" ? feedback : undefined,
				gradedBy: currentUser.id,
				user: currentUser,
				overrideAccess: false,
			});

			if (!gradeResult.ok) {
				const errorMessage = String(gradeResult.error);
				return badRequest({ error: errorMessage });
			}

			return ok({
				success: true,
				submission: gradeResult.value,
				message: "Discussion submission graded successfully",
			});
		} else {
			return badRequest({ error: "Unsupported module type for grading" });
		}
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

		// Release the grade based on module type
		let releaseResult:
			| Awaited<ReturnType<typeof tryReleaseAssignmentGrade>>
			| Awaited<ReturnType<typeof tryReleaseDiscussionGrade>>
			| Awaited<ReturnType<typeof tryReleaseQuizGrade>>;
		if (moduleType === "assignment") {
			releaseResult = await tryReleaseAssignmentGrade({
				payload,
				user: currentUser,
				req: request,
				overrideAccess: false,
				courseActivityModuleLinkId: courseModuleLinkIdValue,
				enrollmentId: enrollmentIdValue,
			});
		} else if (moduleType === "discussion") {
			releaseResult = await tryReleaseDiscussionGrade({
				payload,
				user: currentUser,
				req: request,
				overrideAccess: false,
				courseActivityModuleLinkId: courseModuleLinkIdValue,
				enrollmentId: enrollmentIdValue,
			});
		} else if (moduleType === "quiz") {
			releaseResult = await tryReleaseQuizGrade({
				payload,
				user: currentUser,
				req: request,
				overrideAccess: false,
				courseActivityModuleLinkId: courseModuleLinkIdValue,
				enrollmentId: enrollmentIdValue,
			});
		} else {
			return badRequest({
				error: "Unsupported module type for releasing grades",
			});
		}

		if (!releaseResult.ok) {
			const errorMessage = String(releaseResult.error);
			return badRequest({ error: errorMessage });
		}

		return ok({
			success: true,
			released: true,
			message: "Grade released successfully",
		});
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
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
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

type DiscussionSubmissionType = {
	id: number;
	status: "draft" | "published" | "hidden" | "deleted";
	postType: "thread" | "reply" | "comment";
	title?: string | null;
	content: string;
	publishedAt?: string | null;
	createdAt: string;
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
	grade?: {
		baseGrade: number | null;
		maxGrade: number | null;
		gradedAt?: string | null;
		feedback?: string | null;
	} | null;
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
	const { releaseGrade, isReleasing } = useReleaseGrade();

	// If we're in grading mode, show the appropriate grading view
	if (
		(action === AssignmentActions.GRADE_SUBMISSION ||
			action === QuizActions.GRADE_SUBMISSION) &&
		gradingSubmission &&
		loaderData.gradingModuleType
	) {
		const submissionWithRelations =
			gradingSubmission as typeof gradingSubmission & {
				enrollment?: { id: number } | number | null;
				courseModuleLink?: { id: number } | number | null;
			};

		if (loaderData.gradingModuleType === "assignment") {
			return (
				<AssignmentGradingView
					submission={
						gradingSubmission as Parameters<
							typeof AssignmentGradingView
						>[0]["submission"]
					}
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
		} else if (loaderData.gradingModuleType === "quiz") {
			return (
				<QuizGradingView
					submission={
						gradingSubmission as Parameters<
							typeof QuizGradingView
						>[0]["submission"]
					}
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
		} else if (loaderData.gradingModuleType === "discussion") {
			return (
				<DiscussionGradingView
					submission={
						gradingSubmission as Parameters<
							typeof DiscussionGradingView
						>[0]["submission"]
					}
					module={module}
					moduleSettings={moduleSettings}
					course={course}
					moduleLinkId={loaderData.moduleLinkId}
					grade={loaderData.gradingGrade}
					onReleaseGrade={releaseGrade}
					isReleasing={isReleasing}
					enrollment={submissionWithRelations.enrollment}
					courseModuleLink={submissionWithRelations.courseModuleLink}
					maxGrade={loaderData.maxGrade}
				/>
			);
		}
	}

	const moduleName = moduleSettings && "name" in moduleSettings ? moduleSettings.name : null;
	const title = `${moduleName ?? module.title} - ${module.type === "quiz" ? "Results" : "Submissions"} | ${course.title} | Paideia LMS`;

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
					moduleLinkId={moduleLinkId}
					onReleaseGrade={releaseGrade}
					isReleasing={isReleasing}
				/>
			);
		}

		if (module.type === "discussion") {
			return (
				<DiscussionSubmissionTable
					courseId={course.id}
					enrollments={enrollments}
					submissions={submissions as DiscussionSubmissionType[]}
					moduleLinkId={moduleLinkId}
					onReleaseGrade={releaseGrade}
					isReleasing={isReleasing}
				/>
			);
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
