import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href } from "react-router";
import { typeCreateActionRpc, createActionMap } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { z } from "zod";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindUserEnrollmentInCourse,
	tryUpdateEnrollment,
} from "server/internal/enrollment-management";
import { EnrollmentsSection } from "./components/enrollments-section";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/route";
import { parseAsStringEnum as parseAsStringEnumServer } from "nuqs/server";
import { createLoader } from "nuqs/server";
import { stringify } from "qs";

export type { Route };

enum Action {
	Enroll = "enroll",
	EditEnrollment = "editEnrollment",
	DeleteEnrollment = "deleteEnrollment",
}

// Define search params for participant actions
export const participantActionSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(participantActionSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createEnrollActionRpc = createActionRpc({
	formDataSchema: z.object({
		userId: z.coerce.number(),
		role: z.enum(["student", "teacher", "ta", "manager"]),
		status: z.enum(["active", "inactive", "completed", "dropped"]),
		groups: z.array(z.coerce.number()).optional(),
	}),
	method: "POST",
	action: Action.Enroll,
});

const createEditEnrollmentActionRpc = createActionRpc({
	formDataSchema: z.object({
		enrollmentId: z.coerce.number(),
		role: z.enum(["student", "teacher", "ta", "manager"]),
		status: z.enum(["active", "inactive", "completed", "dropped"]),
		groups: z.array(z.coerce.number()).optional(),
	}),
	method: "POST",
	action: Action.EditEnrollment,
});

const createDeleteEnrollmentActionRpc = createActionRpc({
	formDataSchema: z.object({
		enrollmentId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteEnrollment,
});

export function getRouteUrl(action: Action, courseId: number) {
	return (
		href("/course/:courseId/participants", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		currentUser: currentUser,
	};
};

// Shared authorization check
// TODO: this should be moved to payload collection level 
const checkAuthorization = async (
	context: Route.ActionArgs["context"],
	courseId: number,
) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user's enrollment for this course
	const enrollmentResult = await tryFindUserEnrollmentInCourse({
		payload,
		userId: currentUser.id,
		courseId,
		req: payloadRequest,
	});
	if (!enrollmentResult.ok) {
		return badRequest({ error: enrollmentResult.error.message });
	}
	const enrollment = enrollmentResult.value;

	// Check if user has management access to this course
	const canManage =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		enrollment?.role === "teacher" ||
		enrollment?.role === "manager";

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	return null;
};

const [enrollUserAction, useEnrollUser] = createEnrollActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const courseId = params.courseId;

		const authError = await checkAuthorization(context, courseId);
		if (authError) return authError;

		const createResult = await tryCreateEnrollment({
			payload,
			userId: formData.userId,
			course: courseId,
			role: formData.role,
			status: formData.status,
			groups: formData.groups,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({ success: true, message: "User enrolled successfully" });
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [editEnrollmentAction, useEditEnrollment] = createEditEnrollmentActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const courseIdNum = Number(params.courseId);

		const authError = await checkAuthorization(context, courseIdNum);
		if (authError) return authError;

		const updateResult = await tryUpdateEnrollment({
			payload,
			enrollmentId: formData.enrollmentId,
			role: formData.role,
			status: formData.status,
			groups: formData.groups,
			req: payloadRequest,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({ success: true, message: "Enrollment updated successfully" });
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

const [deleteEnrollmentAction, useDeleteEnrollment] =
	createDeleteEnrollmentActionRpc(
		serverOnly$(async ({ context, formData, params }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);
			const courseIdNum = Number(params.courseId);

			const authError = await checkAuthorization(context, courseIdNum);
			if (authError) return authError;

			const deleteResult = await tryDeleteEnrollment({
				payload,
				enrollmentId: formData.enrollmentId,
				req: payloadRequest,
			});

			if (!deleteResult.ok) {
				return badRequest({ error: deleteResult.error.message });
			}

			return ok({
				success: true,
				message: "Enrollment deleted successfully",
			});
		})!,
		{
			action: ({ searchParams, params }) =>
				getRouteUrl(searchParams.action, Number(params.courseId)),
		},
	);

// Export hooks for use in components
export { useEnrollUser, useEditEnrollment, useDeleteEnrollment };

const [action] = createActionMap({
	[Action.Enroll]: enrollUserAction,
	[Action.EditEnrollment]: editEnrollmentAction,
	[Action.DeleteEnrollment]: deleteEnrollmentAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: "message" in actionData ? actionData.message : "Operation completed successfully",
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseParticipantsPage({
	loaderData,
}: Route.ComponentProps) {
	const { course, currentUser } = loaderData;

	// Prepare available groups for selection
	const availableGroups = course.groups.map((group) => ({
		value: group.id.toString(),
		label: `${group.name} (${group.path})`,
	}));

	// Get enrolled user IDs for exclusion
	const enrolledUserIds = course.enrollments.map(
		(enrollment) => enrollment.user.id,
	);

	return (
		<EnrollmentsSection
			courseId={course.id}
			enrollments={course.enrollments}
			currentUserRole={currentUser.role || "student"}
			availableGroups={availableGroups}
			enrolledUserIds={enrolledUserIds}
		/>
	);
}
