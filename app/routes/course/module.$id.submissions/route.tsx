import { Container, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import {
	createLoader,
	parseAsInteger,
	parseAsStringEnum,
	parseAsStringEnum as parseAsStringEnumServer,

} from "nuqs/server";
import { useState } from "react";
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
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import {
	canDeleteSubmissions,
	canSeeModuleSubmissions,
} from "server/utils/permissions";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { DiscussionGradingView } from "app/routes/course/module.$id.submissions/components/discussion-grading-view";
import { AssignmentGradingView } from "app/routes/course/module.$id.submissions/components/assignment-grading-view";
import { QuizGradingView } from "app/routes/course/module.$id.submissions/components/quiz-grading-view";
import {
	AssignmentBatchActions,
	AssignmentSubmissionTable,
	DiscussionSubmissionTable,
	QuizSubmissionTable,
} from "app/routes/course/module.$id.submissions/components/submission-tables";
import {
	badRequest,
	BadRequestResponse,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/route";

import { isNotNil } from "es-toolkit";
import { href } from "react-router";
import { stringify } from "qs";
import { z } from "zod";

export type { Route };

export enum View {
	GRADING = "grading",
}

export enum Action {
	DeleteSubmission = "deleteSubmission",
	GradeSubmission = "gradeSubmission",
	ReleaseGrade = "releaseGrade",
}

export function getRouteUrl(searchParams: {
	action?: Action;
	view?: View;
	submissionId?: number;
}, moduleLinkId: number) {
	return href("/course/module/:moduleLinkId/submissions", {
		moduleLinkId: moduleLinkId.toString(),
	}) + "?" + stringify(searchParams);
};

// Define search params
export const submissionsSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
	submissionId: parseAsInteger,
	view: parseAsStringEnum(Object.values(View)),
};

export const loadSearchParams = createLoader(submissionsSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createDeleteSubmissionActionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteSubmission,
});

const createGradeSubmissionActionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		score: z.coerce.number(),
		feedback: z.string().optional(),
	}),
	method: "POST",
	action: Action.GradeSubmission,
});

const createReleaseGradeActionRpc = createActionRpc({
	formDataSchema: z.object({
		courseModuleLinkId: z.coerce.number(),
		enrollmentId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.ReleaseGrade,
});

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const { payloadRequest, payload } = context.get(globalContextKey);
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
	const { submissionId, view } = loadSearchParams(request);

	const showGradingView =
		(view === View.GRADING) &&
		submissionId !== null;

	// Fetch gradebook item to get maxGrade for all submissions
	const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
		payload,
		req: payloadRequest,
		courseModuleLinkId: courseModuleContext.id,
	});

	const maxGrade = gradebookItemResult.ok
		? (gradebookItemResult.value.maxGrade ?? null)
		: null;

	// If we're in grading mode, return grading-specific data
	if (showGradingView && courseModuleContext.type === "assignment") {
		const submission = await tryGetAssignmentSubmissionById({
			payload,
			id: submissionId,
			req: payloadRequest,
		}).getOrElse((error) => {
			throw new BadRequestResponse(error.message);
		});

		const gradingGrade = isNotNil(submission.grade)
			? {
				baseGrade: submission.grade,
				maxGrade,
				feedback: submission.feedback || null,
			}
			: null;

		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;

		return {
			mode: "grading" as const,
			gradingModuleType: "assignment" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission: submission,
			gradingGrade,
			view,
			maxGrade,
		};
	}

	if (showGradingView && courseModuleContext.type === "quiz") {
		const submissionResult = await tryGetQuizSubmissionById({
			payload,
			id: submissionId!,
			req: payloadRequest,
		});

		if (!submissionResult.ok) {
			throw new BadRequestResponse(submissionResult.error.message);
		}

		const submission = submissionResult.value;

		// Verify the submission belongs to this module
		if (submission.courseModuleLink !== courseModuleContext.id) {
			throw new ForbiddenResponse("Submission does not belong to this module");
		}

		// Get grade from submission itself
		const submissionWithGrade = submission as typeof submission & {
			grade?: number | null;
			feedback?: string | null;
		};

		const gradingGrade =
			submissionWithGrade.grade !== null &&
				submissionWithGrade.grade !== undefined
				? {
					baseGrade: submissionWithGrade.grade,
					maxGrade,
					feedback: submissionWithGrade.feedback || null,
				}
				: null;

		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;

		return {
			mode: "grading" as const,
			gradingModuleType: "quiz" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission: submission,
			gradingGrade,
			view,
			maxGrade,
		};
	}

	if (showGradingView && courseModuleContext.type === "discussion") {
		const allSubmissions = courseModuleContext.submissions;
		const submission = allSubmissions.find(
			(sub: { id: number }) => sub.id === submissionId,
		);

		if (!submission) {
			throw badRequest({
				error: `Discussion submission with id '${submissionId}' not found`,
			});
		}

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

		const gradingGrade =
			submissionWithGrade.grade !== null &&
				submissionWithGrade.grade !== undefined
				? {
					baseGrade: submissionWithGrade.grade,
					maxGrade,
					feedback: submissionWithGrade.feedback || null,
				}
				: null;

		// Add student submissions to gradingSubmission for display
		const gradingSubmission = {
			...submission,
			studentSubmissions: studentSubmissionsWithParents,
		};

		if (
			courseModuleContext.settings &&
			courseModuleContext.settings.type !== "discussion"
		)
			throw new BadRequestResponse("Module is not a discussion");

		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;

		return {
			mode: "grading" as const,
			gradingModuleType: "discussion" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission,
			gradingGrade,
			view,
			maxGrade,
		};
	}

	// Not in grading mode - return list view data
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

	if (courseModuleContext.type === "assignment") {
		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;
		return {
			mode: "list" as const,
			moduleType: "assignment" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			submissions: submissionsWithGrades,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			view,
			maxGrade,
		};
	}

	if (courseModuleContext.type === "quiz") {
		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;
		return {
			mode: "list" as const,
			moduleType: "quiz" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			submissions: submissionsWithGrades,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			view,
			maxGrade,
		};
	}

	if (courseModuleContext.type === "discussion") {
		// Wrap settings back to match what grading views expect
		const moduleSettings = isNotNil(courseModuleContext.settings)
			? {
				version: "v2" as const,
				settings: courseModuleContext.settings,
			}
			: null;
		return {
			mode: "list" as const,
			moduleType: "discussion" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			submissions: submissionsWithGrades,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			view,
			maxGrade,
		};
	}

	throw new BadRequestResponse("Unsupported module type");
};

const [deleteSubmissionAction, useDeleteSubmission] = createDeleteSubmissionActionRpc(
	async ({ context, formData, params }) => {
		// params is used in the action option for URL generation
		void params;
		const { payload, payloadRequest } = context.get(globalContextKey);
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

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			const id = formData.submissionId;
			// Delete the submission
			const deleteResult = await tryDeleteAssignmentSubmission({
				payload,
				id,
				req: reqWithTransaction,
			});

			if (!deleteResult.ok) {
				return badRequest({ error: deleteResult.error.message });
			}

			return ok({
				success: true,
				message: "Submission deleted successfully",
			});
		});
	},
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(
				{ action: searchParams.action },
				Number(params.moduleLinkId),
			),
	},
);

const [gradeSubmissionAction, useGradeSubmission] = createGradeSubmissionActionRpc(
	async ({ context, formData, params }) => {
		// params is used in the action option for URL generation
		void params;
		const { payload, payloadRequest } = context.get(globalContextKey);
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

		const moduleType = courseModuleContext.type;

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(
			async ({ reqWithTransaction }) => {
				const id = formData.submissionId;


				// Grade the submission based on module type
				if (moduleType === "assignment") {
					const gradeResult = await tryGradeAssignmentSubmission({
						payload,
						req: reqWithTransaction,
						id,
						grade: formData.score,
						feedback: formData.feedback,
						gradedBy: currentUser.id,
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
						req: reqWithTransaction,
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
					const gradebookItemResult =
						await tryFindGradebookItemByCourseModuleLink({
							payload,
							req: reqWithTransaction,
							courseModuleLinkId: courseModuleContext.id,
						});

					if (!gradebookItemResult.ok) {
						return badRequest({ error: "Gradebook item not found" });
					}

					const gradebookItemId = gradebookItemResult.value.id;

					// Grade the quiz submission
					const gradeResult = await tryGradeQuizSubmission({
						payload,
						req: reqWithTransaction,
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
						req: reqWithTransaction,
						id,
						grade: formData.score,
						feedback: formData.feedback,
						gradedBy: currentUser.id,
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
			},
			(errorResponse) => errorResponse.data.status === StatusCode.BadRequest,
		);
	},
	{
		action: ({ params }) =>
			getRouteUrl(
				{ action: Action.GradeSubmission },
				Number(params.moduleLinkId),
			),
	},
);

const [releaseGradeAction, useReleaseGrade] = createReleaseGradeActionRpc(
	async ({ context, formData, params }) => {
		// params is used in the action option for URL generation
		void params;
		const { payload, payloadRequest } = context.get(globalContextKey);
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

		const moduleType = courseModuleContext.type;

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			const courseModuleLinkIdValue = formData.courseModuleLinkId;
			const enrollmentIdValue = formData.enrollmentId;

			// Release the grade based on module type
			let releaseResult:
				| Awaited<ReturnType<typeof tryReleaseAssignmentGrade>>
				| Awaited<ReturnType<typeof tryReleaseDiscussionGrade>>
				| Awaited<ReturnType<typeof tryReleaseQuizGrade>>;
			if (moduleType === "assignment") {
				releaseResult = await tryReleaseAssignmentGrade({
					payload,
					req: reqWithTransaction,
					courseActivityModuleLinkId: courseModuleLinkIdValue,
					enrollmentId: enrollmentIdValue,
				});
			} else if (moduleType === "discussion") {
				releaseResult = await tryReleaseDiscussionGrade({
					payload,
					req: reqWithTransaction,
					courseActivityModuleLinkId: courseModuleLinkIdValue,
					enrollmentId: enrollmentIdValue,
				});
			} else if (moduleType === "quiz") {
				releaseResult = await tryReleaseQuizGrade({
					payload,
					req: reqWithTransaction,
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
		});
	},
	{
		action: ({ params }) =>
			getRouteUrl(
				{ action: Action.ReleaseGrade },
				Number(params.moduleLinkId),
			),
	},
);

export {
	useDeleteSubmission,
	useGradeSubmission,
	useReleaseGrade,
}

const actionMap = {
	[Action.DeleteSubmission]: deleteSubmissionAction,
	[Action.GradeSubmission]: gradeSubmissionAction,
	[Action.ReleaseGrade]: releaseGradeAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({ error: "Action is required" });
	}

	return actionMap[actionType](args);
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData.status === StatusCode.BadRequest ||
		actionData.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	} else if (actionData.status === StatusCode.Ok) {
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
// Main Component
// ============================================================================

export default function ModuleSubmissionsPage({
	loaderData,
}: Route.ComponentProps) {
	// Call hooks unconditionally at the top
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const { submit: deleteSubmission, isLoading: isDeleting } = useDeleteSubmission();
	const { submit: releaseGrade, isLoading: isReleasing } = useReleaseGrade();

	// If we're in grading mode, show the appropriate grading view
	if (loaderData.mode === "grading") {
		if (loaderData.gradingModuleType === "assignment") {
			const submissionWithRelations =
				loaderData.gradingSubmission as typeof loaderData.gradingSubmission & {
					enrollment?: { id: number } | number | null;
					courseModuleLink?: { id: number } | number | null;
				};

			return (
				<AssignmentGradingView
					submission={loaderData.gradingSubmission}
					module={loaderData.module}
					moduleSettings={loaderData.moduleSettings}
					course={loaderData.course}
					moduleLinkId={loaderData.moduleLinkId}
					grade={loaderData.gradingGrade}
					onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
						{
							params: {
								moduleLinkId: loaderData.moduleLinkId,
							},
							values: {
								courseModuleLinkId: courseModuleLinkId,
								enrollmentId: enrollmentId,
							},
						}
					)}
					isReleasing={isReleasing}
					enrollment={submissionWithRelations.enrollment}
					courseModuleLink={submissionWithRelations.courseModuleLink}
				/>
			);
		}

		if (loaderData.gradingModuleType === "quiz") {
			const submissionWithRelations =
				loaderData.gradingSubmission as typeof loaderData.gradingSubmission & {
					enrollment?: { id: number } | number | null;
					courseModuleLink?: { id: number } | number | null;
				};

			return (
				<QuizGradingView
					submission={loaderData.gradingSubmission}
					module={loaderData.module}
					moduleSettings={loaderData.moduleSettings}
					course={loaderData.course}
					moduleLinkId={loaderData.moduleLinkId}
					grade={loaderData.gradingGrade}
					onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
						{
							params: {
								moduleLinkId: loaderData.moduleLinkId,
							},
							values: {
								courseModuleLinkId: courseModuleLinkId,
								enrollmentId: enrollmentId,
							},
						}
					)}
					isReleasing={isReleasing}
					enrollment={submissionWithRelations.enrollment}
					courseModuleLink={submissionWithRelations.courseModuleLink}
				/>
			);
		}

		if (loaderData.gradingModuleType === "discussion") {
			const submissionWithRelations =
				loaderData.gradingSubmission as typeof loaderData.gradingSubmission & {
					enrollment?: { id: number } | number | null;
					courseModuleLink?: { id: number } | number | null;
				};

			return (
				<DiscussionGradingView
					submission={
						loaderData.gradingSubmission as Parameters<
							typeof DiscussionGradingView
						>[0]["submission"]
					}
					module={loaderData.module}
					moduleSettings={loaderData.moduleSettings}
					course={loaderData.course}
					moduleLinkId={loaderData.moduleLinkId}
					grade={loaderData.gradingGrade}
					onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
						{
							params: {
								moduleLinkId: loaderData.moduleLinkId,
							},
							values: {
								courseModuleLinkId: courseModuleLinkId,
								enrollmentId: enrollmentId,
							},
						}
					)}
					isReleasing={isReleasing}
					enrollment={submissionWithRelations.enrollment}
					courseModuleLink={submissionWithRelations.courseModuleLink}
					maxGrade={loaderData.maxGrade}
				/>
			);
		}
	}

	// List mode - render submissions table
	const moduleName =
		loaderData.moduleSettings && "name" in loaderData.moduleSettings
			? loaderData.moduleSettings.name
			: null;
	const title = `${moduleName ?? loaderData.module.title} - ${loaderData.module.type === "quiz" ? "Results" : "Submissions"} | ${loaderData.course.title} | Paideia LMS`;

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
		if (loaderData.moduleType === "assignment") {
			const selectedEnrollments = loaderData.enrollments.filter((e) =>
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
						courseId={loaderData.course.id}
						enrollments={loaderData.enrollments}
						submissions={
							loaderData.submissions as Parameters<
								typeof AssignmentSubmissionTable
							>[0]["submissions"]
						}
						selectedRows={selectedRows}
						onSelectRow={handleSelectRow}
						canDelete={loaderData.canDelete}
						onDeleteSubmission={(submissionId) =>
							deleteSubmission({
								params: {
									moduleLinkId: loaderData.moduleLinkId,
								},
								values: {
									submissionId: submissionId,
								},
							})
						}
						moduleLinkId={loaderData.moduleLinkId}
						onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
							{
								params: {
									moduleLinkId: loaderData.moduleLinkId,
								},
								values: {
									courseModuleLinkId: courseModuleLinkId,
									enrollmentId: enrollmentId,
								},
							}
						)}
						isReleasing={isReleasing}
					/>
				</Stack>
			);
		}

		if (loaderData.moduleType === "quiz") {
			return (
				<QuizSubmissionTable
					courseId={loaderData.course.id}
					enrollments={loaderData.enrollments}
					submissions={
						loaderData.submissions as Parameters<
							typeof QuizSubmissionTable
						>[0]["submissions"]
					}
					moduleLinkId={loaderData.moduleLinkId}
					onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
						{
							params: {
								moduleLinkId: loaderData.moduleLinkId,
							},
							values: {
								courseModuleLinkId: courseModuleLinkId,
								enrollmentId: enrollmentId,
							},
						}
					)}
					isReleasing={isReleasing}
				/>
			);
		}

		if (loaderData.moduleType === "discussion") {
			return (
				<DiscussionSubmissionTable
					courseId={loaderData.course.id}
					enrollments={loaderData.enrollments}
					submissions={loaderData.submissions}
					moduleLinkId={loaderData.moduleLinkId}
					onReleaseGrade={(courseModuleLinkId, enrollmentId) => releaseGrade(
						{
							params: {
								moduleLinkId: loaderData.moduleLinkId,
							},
							values: {
								courseModuleLinkId: courseModuleLinkId,
								enrollmentId: enrollmentId,
							},
						}
					)}
					isReleasing={isReleasing}
				/>
			);
		}

		return null;
	};

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`${loaderData.module.title} submissions`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`${loaderData.module.title} submissions`}
			/>

			{renderSubmissions()}
		</Container>
	);
}
