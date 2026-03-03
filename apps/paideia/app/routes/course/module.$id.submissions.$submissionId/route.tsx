import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { courseContextKey } from "server/contexts/course-context";
import {
	courseModuleContextKey,
	tryGetCourseModuleContext,
} from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetAssignmentSubmissionById } from "@paideia/paideia-backend";
import { tryFindGradebookItemByCourseModuleLink } from "@paideia/paideia-backend";
import { tryGetQuizSubmissionById } from "@paideia/paideia-backend";
import {
	badRequest,
	BadRequestResponse,
	ForbiddenResponse,
} from "app/utils/router/responses";
import type { Route } from "./+types/route";
import { isNotNil } from "es-toolkit";
import { DiscussionGradingView } from "./components/discussion/discussion-grading-view";
import { AssignmentGradingView } from "./components/assignments/assignment-grading-view";
import { QuizGradingView } from "./components/quiz/quiz-grading-view";

export type { Route };

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({})(async ({ context, params }) => {
	const { submissionId } = params;
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
		(enrollment: { role?: string | null }) => enrollment.role === "student",
	);

	// Fetch gradebook item to get maxGrade for all submissions
	const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
		payload,
		req: payloadRequest,
		courseModuleLinkId: courseModuleContext.id,
	});

	const maxGrade = gradebookItemResult.ok
		? (gradebookItemResult.value.maxGrade ?? null)
		: null;

	// Handle grading view based on module type
	if (courseModuleContext.type === "assignment") {
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
			gradingModuleType: "assignment" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission: submission,
			gradingGrade,
			maxGrade,
		};
	}

	if (courseModuleContext.type === "quiz") {
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
			gradingModuleType: "quiz" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission: submission,
			gradingGrade,
			maxGrade,
		};
	}

	if (courseModuleContext.type === "discussion") {
		// Use gradingSubmission from context that was already fetched in middleware
		const gradingSubmission = courseModuleContext.gradingSubmission;

		if (!gradingSubmission) {
			throw badRequest({
				error: `Discussion submission with id '${submissionId}' not found`,
			});
		}
		const submissionWithGrade =
			gradingSubmission as typeof gradingSubmission & {
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
			gradingModuleType: "discussion" as const,
			module: courseModuleContext.activityModule,
			moduleSettings,
			course: courseContext.course,
			enrollments,
			moduleLinkId: courseModuleContext.id,
			canDelete,
			gradingSubmission,
			gradingGrade,
			maxGrade,
		};
	}

	throw new BadRequestResponse("Unsupported module type");
});

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

// ============================================================================
// Main Component
// ============================================================================

export default function ModuleSubmissionGradingPage({
	loaderData,
}: Route.ComponentProps) {
	if (loaderData.gradingModuleType === "assignment") {
		return <AssignmentGradingView loaderData={loaderData} />;
	}

	if (loaderData.gradingModuleType === "quiz") {
		const submissionWithRelations = loaderData.gradingSubmission;

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
		const submissionWithRelations = loaderData.gradingSubmission;

		return (
			<DiscussionGradingView
				submission={loaderData.gradingSubmission}
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

	return null;
}
