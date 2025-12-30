import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useState } from "react";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
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
import type { Enrollment } from "server/payload-types";
import { DeleteEnrollmentModal } from "~/components/delete-enrollment-modal";
import { EditEnrollmentModal } from "~/components/edit-enrollment-modal";
import { EnrollUserModal } from "~/components/enroll-user-modal";
import { EnrollmentsSection } from "~/components/enrollments-section";
import type { SearchUser } from "~/routes/api/search-users";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.participants";
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
		const { courseId } = params;
		const courseIdNum = Number(courseId);

		const authError = await checkAuthorization(context, courseIdNum);
		if (authError) return authError;

		const createResult = await tryCreateEnrollment({
			payload,
			userId: formData.userId,
			course: courseIdNum,
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

const actionMap = {
	[Action.Enroll]: enrollUserAction,
	[Action.EditEnrollment]: editEnrollmentAction,
	[Action.DeleteEnrollment]: deleteEnrollmentAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	return actionMap[actionType](args);
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
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

	// Action hooks
	const { submit: enrollUser, isLoading: isEnrolling } = useEnrollUser();
	const { submit: editEnrollment, isLoading: isEditing } = useEditEnrollment();
	const { submit: deleteEnrollment, isLoading: isDeleting } =
		useDeleteEnrollment();

	// Modal states
	const [
		enrollModalOpened,
		{ open: openEnrollModal, close: closeEnrollModal },
	] = useDisclosure(false);
	const [editModalOpened, { open: openEditModal, close: closeEditModal }] =
		useDisclosure(false);
	const [
		deleteModalOpened,
		{ open: openDeleteModal, close: closeDeleteModal },
	] = useDisclosure(false);

	// Form states
	const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
	const [selectedRole, setSelectedRole] = useState<string | null>(null);
	const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
	const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
	const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(
		null,
	);
	const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<
		number | null
	>(null);

	// Prepare available groups for selection
	const availableGroups = course.groups.map((group) => ({
		value: group.id.toString(),
		label: `${group.name} (${group.path})`,
	}));

	// Enrollment handlers
	const handleEnrollUsers = async () => {
		if (selectedUsers.length > 0 && selectedRole && selectedStatus) {
			// Submit each user enrollment
			for (const user of selectedUsers) {
				await enrollUser({
					values: {
						userId: user.id,
						role: selectedRole as Enrollment["role"],
						status: selectedStatus as Enrollment["status"],
						groups: selectedGroups.map(Number),
					},
					params: { courseId: course.id },
				});
			}
			closeEnrollModal();
			setSelectedUsers([]);
			setSelectedRole(null);
			setSelectedStatus(null);
			setSelectedGroups([]);
		}
	};

	const handleEditEnrollment = (
		enrollment: NonNullable<Route.ComponentProps["loaderData"]["enrolment"]>,
	) => {
		// Convert CourseEnrollment to payload Enrollment type for the modal
		const payloadEnrollment: Enrollment = {
			id: enrollment.id,
			user: enrollment.user.id,
			course: 0, // This will be set by the modal
			role: enrollment.role,
			status: enrollment.status,
			enrolledAt: enrollment.enrolledAt,
			completedAt: enrollment.completedAt,
			updatedAt: "",
			createdAt: "",
		};
		setEditingEnrollment(payloadEnrollment);
		setSelectedRole(enrollment.role);
		setSelectedStatus(enrollment.status);
		setSelectedGroups(enrollment.groups.map((g) => g.id.toString()));
		openEditModal();
	};

	const handleUpdateEnrollment = async () => {
		if (editingEnrollment && selectedRole && selectedStatus) {
			await editEnrollment({
				values: {
					enrollmentId: editingEnrollment.id,
					role: selectedRole as Enrollment["role"],
					status: selectedStatus as Enrollment["status"],
					groups: selectedGroups.map(Number),
				},
				params: { courseId: course.id },
			});
			closeEditModal();
			setEditingEnrollment(null);
			setSelectedRole(null);
			setSelectedStatus(null);
			setSelectedGroups([]);
		}
	};

	const handleDeleteEnrollment = (enrollmentId: number) => {
		setDeletingEnrollmentId(enrollmentId);
		openDeleteModal();
	};

	const handleConfirmDeleteEnrollment = async () => {
		if (deletingEnrollmentId) {
			await deleteEnrollment({
				values: {
					enrollmentId: deletingEnrollmentId,
				},
				params: { courseId: course.id },
			});
			closeDeleteModal();
			setDeletingEnrollmentId(null);
		}
	};

	const fetcherState =
		isEnrolling || isEditing || isDeleting ? "submitting" : "idle";

	// Get enrolled user IDs for exclusion
	const enrolledUserIds = course.enrollments.map(
		(enrollment) => enrollment.user.id,
	);

	return (
		<>
			<EnrollmentsSection
				courseId={course.id}
				enrollments={course.enrollments}
				currentUserRole={currentUser.role || "student"}
				fetcherState={fetcherState}
				onOpenEnrollModal={openEnrollModal}
				onEditEnrollment={handleEditEnrollment}
				onDeleteEnrollment={handleDeleteEnrollment}
			/>

			<EnrollUserModal
				opened={enrollModalOpened}
				onClose={closeEnrollModal}
				selectedUsers={selectedUsers}
				onSelectedUsersChange={setSelectedUsers}
				selectedRole={selectedRole}
				onSelectedRoleChange={setSelectedRole}
				selectedStatus={selectedStatus}
				onSelectedStatusChange={setSelectedStatus}
				selectedGroups={selectedGroups}
				onSelectedGroupsChange={setSelectedGroups}
				availableGroups={availableGroups}
				enrolledUserIds={enrolledUserIds}
				fetcherState={fetcherState}
				onEnrollUsers={handleEnrollUsers}
			/>

			<EditEnrollmentModal
				opened={editModalOpened}
				onClose={closeEditModal}
				selectedRole={selectedRole}
				onSelectedRoleChange={setSelectedRole}
				selectedStatus={selectedStatus}
				onSelectedStatusChange={setSelectedStatus}
				selectedGroups={selectedGroups}
				onSelectedGroupsChange={setSelectedGroups}
				availableGroups={availableGroups}
				fetcherState={fetcherState}
				onUpdateEnrollment={handleUpdateEnrollment}
			/>

			<DeleteEnrollmentModal
				opened={deleteModalOpened}
				onClose={closeDeleteModal}
				fetcherState={fetcherState}
				onConfirmDelete={handleConfirmDeleteEnrollment}
			/>
		</>
	);
}
