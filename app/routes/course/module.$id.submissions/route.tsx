import { Container } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { parseAsInteger, parseAsStringEnum } from "nuqs/server";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { courseContextKey } from "server/contexts/course-context";
import {
	courseModuleContextKey,
	tryGetCourseModuleContext,
} from "server/contexts/course-module-context";
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
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { DiscussionGradingView } from "app/routes/course/module.$id.submissions/components/discussion/discussion-grading-view";
import { AssignmentGradingView } from "app/routes/course/module.$id.submissions/components/assignments/assignment-grading-view";
import { QuizGradingView } from "app/routes/course/module.$id.submissions/components/quiz/quiz-grading-view";
import { AssignmentSubmissionTable } from "app/routes/course/module.$id.submissions/components/assignments/assignment-submission-table";
import { QuizSubmissionTable } from "app/routes/course/module.$id.submissions/components/quiz/quiz-submission-table";
import { DiscussionSubmissionTable } from "app/routes/course/module.$id.submissions/components/discussion/discussion-submission-table";
import {
	badRequest,
	BadRequestResponse,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/route";
import { isNotNil } from "es-toolkit";
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

// Define search params
export const loaderSearchParams = {
	// action: parseAsStringEnum(Object.values(Action)),
	submissionId: parseAsInteger,
	view: parseAsStringEnum(Object.values(View)),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/module/:moduleLinkId/submissions",
});

const deleteSubmissionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteSubmission,
});

const gradeSubmissionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		score: z.coerce.number(),
		feedback: z.string().optional(),
	}),
	method: "POST",
	action: Action.GradeSubmission,
});

const releaseGradeRpc = createActionRpc({
	formDataSchema: z.object({
		courseModuleLinkId: z.coerce.number(),
		enrollmentId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.ReleaseGrade,
});

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams }) => {
	const { submissionId, view } = searchParams;
	const { payloadRequest, payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Check if user can see submissions
	const canSee = courseModuleContext.permissions.canSeeSubmissions.allowed;
	if (!canSee) {
		throw new ForbiddenResponse(
			"You don't have permission to view submissions",
		);
	}
	const canDelete = courseModuleContext.permissions.canDelete.allowed;
	// Get all enrollments for this course to show all students, filter out students
	const enrollments = courseContext.course.enrollments.filter(
		(enrollment) => enrollment.role === "student",
	);


	const showGradingView = view === View.GRADING && submissionId !== null;

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
			searchParams,
		};
	}

	if (showGradingView && courseModuleContext.type === "quiz") {
		const submission = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			req: payloadRequest,
		}).getOrElse((error) => {
			throw new BadRequestResponse(error.message);
		});

		// Verify the submission belongs to this module
		if (submission.courseModuleLink !== courseModuleContext.id) {
			throw new ForbiddenResponse("Submission does not belong to this module");
		}

		// Get grade from submission itself
		// TODO: This is very weird

		const gradingGrade = isNotNil(submission.grade)
			? {
				baseGrade: submission.grade,
				maxGrade,
				feedback: submission.feedback ?? null,
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
			searchParams,
		};
	}

	if (showGradingView && courseModuleContext.type === "discussion") {
		// Re-fetch context with submissionId to get processed gradingSubmission
		const contextWithSubmission = await tryGetCourseModuleContext({
			payload,
			moduleLinkId: courseModuleContext.id,
			courseId: courseContext.course.id,
			enrolment: context.get(enrolmentContextKey)?.enrolment ?? null,
			threadId: null,
			submissionId: submissionId,
			req: payloadRequest,
		}).getOrElse((error) => {
			throw new BadRequestResponse(error.message);
		});

		const contextWithGrading = contextWithSubmission as any;

		if (!contextWithGrading.gradingSubmission) {
			throw badRequest({
				error: `Discussion submission with id '${submissionId}' not found`,
			});
		}

		const gradingSubmission = contextWithGrading.gradingSubmission;
		const submissionWithGrade = gradingSubmission as typeof gradingSubmission & {
			grade?: number | null;
			feedback?: string | null;
		};

		const gradingGrade = isNotNil(submissionWithGrade.grade)
			? {
				baseGrade: submissionWithGrade.grade,
				maxGrade,
				feedback: submissionWithGrade.feedback ?? null,
			}
			: null;

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
			searchParams,
		};
	}

	// Not in grading mode - return list view data
	if (courseModuleContext.type === "assignment") {
		const allSubmissions = courseModuleContext.submissions;

		// Map submissions with grades from submission.grade field
		const submissionsWithGrades = allSubmissions.map((submission) => {
			return {
				...submission,
				grade:
					submission.grade !== null &&
						submission.grade !== undefined
						? {
							baseGrade: submission.grade,
							maxGrade,
							gradedAt: submission.gradedAt || null,
							feedback: submission.feedback || null,
						}
						: null,
			};
		});

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
			searchParams,
		};
	}

	if (courseModuleContext.type === "quiz") {
		const allSubmissions = courseModuleContext.submissions;

		// Map submissions with grades from submission.grade field
		const submissionsWithGrades = allSubmissions.map((submission) => {
			return {
				...submission,
				grade:
					submission.grade !== null &&
						submission.grade !== undefined
						? {
							baseGrade: submission.grade,
							maxGrade,
							gradedAt: submission.gradedAt || null,
							feedback: submission.feedback || null,
						}
						: null,
			};
		});

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
			searchParams,
		};
	}

	if (courseModuleContext.type === "discussion") {
		const allSubmissions = courseModuleContext.submissions;

		// Map submissions with grades from submission.grade field
		const submissionsWithGrades = allSubmissions.map((submission) => {
			return {
				...submission,
				grade:
					submission.grade !== null &&
						submission.grade !== undefined
						? {
							baseGrade: submission.grade,
							maxGrade,
							gradedAt: submission.gradedAt || null,
							feedback: submission.feedback || null,
						}
						: null,
			};
		});

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
			searchParams,
		};
	}

	throw new BadRequestResponse("Unsupported module type");
});

const deleteSubmissionAction = deleteSubmissionRpc.createAction(
	async ({ context, formData, }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseModuleContext = context.get(courseModuleContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Check if user can delete submissions
		if (!courseModuleContext.permissions.canDelete.allowed) {
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
);

const useDeleteSubmission =
	deleteSubmissionRpc.createHook<typeof deleteSubmissionAction>();

const gradeSubmissionAction = gradeSubmissionRpc.createAction(
	async ({ context, formData, params }) => {
		// params is used in the action option for URL generation
		void params;
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
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
		if (!courseModuleContext.permissions.canSeeSubmissions.allowed) {
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
						submission.enrollment?.id ?? null;

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
);

const useGradeSubmission =
	gradeSubmissionRpc.createHook<typeof gradeSubmissionAction>();

const releaseGradeAction = releaseGradeRpc.createAction(
	async ({ context, formData, params }) => {
		// params is used in the action option for URL generation
		void params;
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseModuleContext = context.get(courseModuleContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Check if user can grade submissions (same as viewing submissions)
		if (!courseModuleContext.permissions.canSeeSubmissions.allowed) {
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

			// Release the grade based on module type using const instead of let for type inference
			const releaseResult =
				moduleType === "assignment"
					? await tryReleaseAssignmentGrade({
						payload,
						req: reqWithTransaction,
						courseActivityModuleLinkId: courseModuleLinkIdValue,
						enrollmentId: enrollmentIdValue,
					})
					: moduleType === "discussion"
						? await tryReleaseDiscussionGrade({
							payload,
							req: reqWithTransaction,
							courseActivityModuleLinkId: courseModuleLinkIdValue,
							enrollmentId: enrollmentIdValue,
						})
						: moduleType === "quiz"
							? await tryReleaseQuizGrade({
								payload,
								req: reqWithTransaction,
								courseActivityModuleLinkId: courseModuleLinkIdValue,
								enrollmentId: enrollmentIdValue,
							})
							: null;

			if (!releaseResult) {
				return badRequest({
					error: "Unsupported module type for releasing grades",
				});
			}

			if (!releaseResult.ok) {
				return badRequest({ error: releaseResult.error.message });
			}

			return ok({
				success: true,
				released: true,
				message: "Grade released successfully",
			});
		});
	},
);

const useReleaseGrade = releaseGradeRpc.createHook<typeof releaseGradeAction>();

export { useDeleteSubmission, useGradeSubmission, useReleaseGrade };

const [action] = createActionMap({
	[Action.DeleteSubmission]: deleteSubmissionAction,
	[Action.GradeSubmission]: gradeSubmissionAction,
	[Action.ReleaseGrade]: releaseGradeAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (!actionData) return;

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

			{
				loaderData.moduleType === "assignment" ? (
					<AssignmentSubmissionTable
						courseId={loaderData.course.id}
						enrollments={loaderData.enrollments}
						canDelete={loaderData.canDelete}
						submissions={
							loaderData.submissions as Parameters<
								typeof AssignmentSubmissionTable
							>[0]["submissions"]
						}
						moduleLinkId={loaderData.moduleLinkId}
					/>
				) : loaderData.moduleType === "quiz" ? (
					<QuizSubmissionTable
						courseId={loaderData.course.id}
						enrollments={loaderData.enrollments}
						submissions={
							loaderData.submissions as Parameters<
								typeof QuizSubmissionTable
							>[0]["submissions"]
						}
						moduleLinkId={loaderData.moduleLinkId}
					/>
				) : loaderData.moduleType === "discussion" ? (
					<DiscussionSubmissionTable
						courseId={loaderData.course.id}
						enrollments={loaderData.enrollments}
						submissions={loaderData.submissions}
						moduleLinkId={loaderData.moduleLinkId}
					/>
				) : null
			}
		</Container>
	);
}
