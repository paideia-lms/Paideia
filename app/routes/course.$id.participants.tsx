import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { Enrollment as CourseEnrollment } from "server/contexts/course-context";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryUpdateEnrollment,
} from "server/internal/enrollment-management";
import type { Enrollment } from "server/payload-types";
import { DeleteEnrollmentModal } from "~/components/delete-enrollment-modal";
import { EditEnrollmentModal } from "~/components/edit-enrollment-modal";
import { EnrollUserModal } from "~/components/enroll-user-modal";
import { EnrollmentsSection } from "~/components/enrollments-section";
import type { SearchUser } from "~/routes/api/search-users";
import {
	BadRequestResponse,
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.participants";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const { courseId } = params;

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

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const { courseId } = params;
	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user's enrollment for this course
	const enrollments = await payload.find({
		collection: "enrollments",
		where: {
			and: [
				{ user: { equals: currentUser.id } },
				{ course: { equals: courseId } },
			],
		},
		limit: 1,
	});

	const enrollment = enrollments.docs[0];

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

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "enroll") {
		const userId = Number(formData.get("userId"));
		const role = formData.get("role") as
			| "student"
			| "teacher"
			| "ta"
			| "manager";
		const status = formData.get("status") as
			| "active"
			| "inactive"
			| "completed"
			| "dropped";

		// Get groups array from formData
		const groupIds = formData
			.getAll("groups")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id));

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
			user: currentUser,
			req: request,
			overrideAccess: false,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({ success: true, message: "User enrolled successfully" });
	}

	if (intent === "edit-enrollment") {
		const enrollmentId = Number(formData.get("enrollmentId"));
		const role = formData.get("role") as
			| "student"
			| "teacher"
			| "ta"
			| "manager";
		const status = formData.get("status") as
			| "active"
			| "inactive"
			| "completed"
			| "dropped";

		// Get groups array from formData
		const groupIds = formData
			.getAll("groups")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id));

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
			user: currentUser,
			req: request,
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({ success: true, message: "Enrollment updated successfully" });
	}

	if (intent === "delete-enrollment") {
		const enrollmentId = Number(formData.get("enrollmentId"));
		if (Number.isNaN(enrollmentId)) {
			return badRequest({ error: "Invalid enrollment ID" });
		}

		const deleteResult = await tryDeleteEnrollment({
			payload,
			enrollmentId,
			user: currentUser,
			req: request,
			overrideAccess: false,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Enrollment deleted successfully" });
	}

	return badRequest({ error: "Invalid intent" });
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
	const fetcher = useFetcher<typeof action>();

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

	const { course, currentUser } = loaderData;

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
				const formData = new FormData();
				formData.append("intent", "enroll");
				formData.append("userId", user.id.toString());
				formData.append("role", selectedRole);
				formData.append("status", selectedStatus);

				// Add selected groups
				selectedGroups.forEach((groupId) => {
					formData.append("groups", groupId);
				});

				fetcher.submit(formData, { method: "post" });
			});
			closeEnrollModal();
			setSelectedUsers([]);
			setSelectedRole(null);
			setSelectedStatus(null);
			setSelectedGroups([]);
		}
	};

	const handleEditEnrollment = (enrollment: CourseEnrollment) => {
		// Convert CourseEnrollment to payload Enrollment type for the modal
		const payloadEnrollment: Enrollment = {
			id: enrollment.id,
			user: enrollment.userId,
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
			const formData = new FormData();
			formData.append("intent", "edit-enrollment");
			formData.append("enrollmentId", editingEnrollment.id.toString());
			formData.append("role", selectedRole);
			formData.append("status", selectedStatus);

			// Add selected groups
			selectedGroups.forEach((groupId) => {
				formData.append("groups", groupId);
			});

			fetcher.submit(formData, { method: "post" });
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
			fetcher.submit(
				{
					intent: "delete-enrollment",
					enrollmentId: deletingEnrollmentId.toString(),
				},
				{ method: "post" },
			);
			closeDeleteModal();
			setDeletingEnrollmentId(null);
		}
	};

	// Get enrolled user IDs for exclusion
	const enrolledUserIds = course.enrollments.map(
		(enrollment) => enrollment.userId,
	);

	return (
		<>
			<EnrollmentsSection
				courseId={course.id}
				enrollments={course.enrollments}
				currentUserRole={currentUser.role || "student"}
				fetcherState={fetcher.state}
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
				fetcherState={fetcher.state}
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
				fetcherState={fetcher.state}
				onUpdateEnrollment={handleUpdateEnrollment}
			/>

			<DeleteEnrollmentModal
				opened={deleteModalOpened}
				onClose={closeDeleteModal}
				fetcherState={fetcher.state}
				onConfirmDelete={handleConfirmDeleteEnrollment}
			/>
		</>
	);
}
