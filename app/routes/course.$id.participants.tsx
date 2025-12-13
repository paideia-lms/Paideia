import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useState } from "react";
import { useFetcher, href } from "react-router";
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
import { assertRequestMethod } from "~/utils/assert-request-method";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";

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

const getActionUrl = (action: Action, courseId: string) => {
	return (
		href("/course/:courseId/participants", {
			courseId,
		}) +
		"?" +
		stringify({ action })
	);
};

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

export const action = async (args: Route.ActionArgs) => {
	const { request, context } = args;
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { courseId } = args.params;

	assertRequestMethod(request.method, "POST");

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user's enrollment for this course
	const enrollmentResult = await tryFindUserEnrollmentInCourse({
		payload,
		userId: currentUser.id,
		courseId: Number(courseId),
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

	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	if (actionType === Action.Enroll) {
		return enrollUserAction({ ...args, searchParams: { action: actionType } });
	}

	if (actionType === Action.EditEnrollment) {
		return editEnrollmentAction({ ...args, searchParams: { action: actionType } });
	}

	if (actionType === Action.DeleteEnrollment) {
		return deleteEnrollmentAction({ ...args, searchParams: { action: actionType } });
	}

	return badRequest({ error: "Invalid action" });
};

const enrollUserAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action.Enroll } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { courseId } = params;
	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		userId: number;
		role: Enrollment["role"];
		status: Enrollment["status"];
		groups?: number[];
	};

	const userId = requestData.userId;
	const role = requestData.role;
	const status = requestData.status;
	const groupIds = requestData.groups || [];

	if (Number.isNaN(userId)) {
		return badRequest({ error: "Invalid user ID" });
	}

	if (!role || !status) {
		return badRequest({ error: "Role and status are required" });
	}

	const createResult = await tryCreateEnrollment({
		payload,
		userId: userId,
		course: Number(courseId),
		role,
		status,
		groups: groupIds,
		req: payloadRequest,
	});

	if (!createResult.ok) {
		return badRequest({ error: createResult.error.message });
	}

	return ok({ success: true, message: "User enrolled successfully" });
};

const editEnrollmentAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.EditEnrollment } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		enrollmentId: number;
		role: Enrollment["role"];
		status: Enrollment["status"];
		groups?: number[];
	};

	const enrollmentId = requestData.enrollmentId;
	const role = requestData.role;
	const status = requestData.status;
	const groupIds = requestData.groups || [];

	if (Number.isNaN(enrollmentId)) {
		return badRequest({ error: "Invalid enrollment ID" });
	}

	if (!role || !status) {
		return badRequest({ error: "Role and status are required" });
	}

	const updateResult = await tryUpdateEnrollment({
		payload,
		enrollmentId,
		role,
		status,
		groups: groupIds,
		req: payloadRequest,
	});

	if (!updateResult.ok) {
		return badRequest({ error: updateResult.error.message });
	}

	return ok({ success: true, message: "Enrollment updated successfully" });
};

const deleteEnrollmentAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.DeleteEnrollment } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		enrollmentId: number;
	};

	const enrollmentId = requestData.enrollmentId;
	if (Number.isNaN(enrollmentId)) {
		return badRequest({ error: "Invalid enrollment ID" });
	}

	const deleteResult = await tryDeleteEnrollment({
		payload,
		enrollmentId,
		req: payloadRequest,
	});

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	return ok({ success: true, message: "Enrollment deleted successfully" });
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

// Custom hooks for participant actions
function useEnrollUser(courseId: string) {
	const fetcher = useFetcher<typeof action>();

	const enrollUser = (values: {
		userId: number;
		role: Enrollment["role"];
		status: Enrollment["status"];
		groups?: number[];
	}) => {
		fetcher.submit(
			{
				userId: values.userId,
				role: values.role,
				status: values.status,
				groups: values.groups || [],
			},
			{
				method: "POST",
				action: getActionUrl(Action.Enroll, courseId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		enrollUser,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useEditEnrollment(courseId: string) {
	const fetcher = useFetcher<typeof action>();

	const editEnrollment = (values: {
		enrollmentId: number;
		role: "student" | "teacher" | "ta" | "manager";
		status: "active" | "inactive" | "completed" | "dropped";
		groups?: number[];
	}) => {
		fetcher.submit(
			{
				enrollmentId: values.enrollmentId,
				role: values.role,
				status: values.status,
				groups: values.groups || [],
			},
			{
				method: "POST",
				action: getActionUrl(Action.EditEnrollment, courseId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		editEnrollment,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useDeleteEnrollment(courseId: string) {
	const fetcher = useFetcher<typeof action>();

	const deleteEnrollment = (enrollmentId: number) => {
		fetcher.submit(
			{
				enrollmentId,
			},
			{
				method: "POST",
				action: getActionUrl(Action.DeleteEnrollment, courseId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		deleteEnrollment,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseParticipantsPage({
	loaderData,
}: Route.ComponentProps) {
	const { course, currentUser } = loaderData;
	const courseId = String(course.id);

	// Action hooks
	const { enrollUser, isLoading: isEnrolling } = useEnrollUser(courseId);
	const { editEnrollment, isLoading: isEditing } = useEditEnrollment(courseId);
	const { deleteEnrollment, isLoading: isDeleting } =
		useDeleteEnrollment(courseId);

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
	const handleEnrollUsers = () => {
		if (selectedUsers.length > 0 && selectedRole && selectedStatus) {
			// Submit each user enrollment
			selectedUsers.forEach((user) => {
				enrollUser({
					userId: user.id,
					role: selectedRole as Enrollment["role"],
					status: selectedStatus as Enrollment["status"],
					groups: selectedGroups.map(Number),
				});
			});
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

	const handleUpdateEnrollment = () => {
		if (editingEnrollment && selectedRole && selectedStatus) {
			editEnrollment({
				enrollmentId: editingEnrollment.id,
				role: selectedRole as Enrollment["role"],
				status: selectedStatus as Enrollment["status"],
				groups: selectedGroups.map(Number),
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

	const handleConfirmDeleteEnrollment = () => {
		if (deletingEnrollmentId) {
			deleteEnrollment(deletingEnrollmentId);
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
