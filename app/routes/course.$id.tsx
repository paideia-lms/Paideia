import {
	Badge,
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconEdit } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import type { Enrollment as CourseEnrollment } from "server/contexts/course-context";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateCourseActivityModuleLink,
	tryDeleteCourseActivityModuleLink,
} from "server/internal/course-activity-module-link-management";
import { tryCreateSection } from "server/internal/course-section-management";
import {
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryUpdateEnrollment,
} from "server/internal/enrollment-management";
import type { Enrollment } from "server/payload-types";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import { CourseInfo } from "~/components/course-info";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
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
import type { Route } from "./+types/course.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			error: "Invalid course ID",
		});
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({ error: "Invalid course ID" });
	}

	// Get course to check ownership
	const course = await payload.findByID({
		collection: "courses",
		id: courseId,
		user: currentUser,
		req: request,
		overrideAccess: false,
	});

	if (!course) {
		return badRequest({ error: "Course not found" });
	}

	// Check if user has management access to this course
	const courseCreatedById =
		typeof course.createdBy === "number"
			? course.createdBy
			: course.createdBy.id;

	const canManage =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		courseCreatedById === currentUser.id;

	if (!canManage) {
		return unauthorized({
			error: "You don't have permission to manage this course",
		});
	}

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "create") {
		const activityModuleId = Number(formData.get("activityModuleId"));
		if (Number.isNaN(activityModuleId)) {
			return badRequest({ error: "Invalid activity module ID" });
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			return badRequest({ error: "Failed to begin transaction" });
		}

		try {
			// Create a default section if none exists
			const sectionResult = await tryCreateSection({
				payload,
				data: {
					course: courseId,
					title: "Default Section",
					description: "Default section for activity modules",
				},
				req: { ...request, transactionID },
				overrideAccess: true,
			});

			if (!sectionResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: "Failed to create section" });
			}

			const createResult = await tryCreateCourseActivityModuleLink(
				payload,
				request,
				{
					course: courseId,
					activityModule: activityModuleId,
					section: sectionResult.value.id,
					order: 0,
					transactionID,
				},
			);

			if (!createResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: createResult.error.message });
			}

			await payload.db.commitTransaction(transactionID);
			return ok({
				success: true,
				message: "Activity module linked successfully",
			});
		} catch {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "Failed to create link" });
		}
	}

	if (intent === "delete") {
		const linkId = Number(formData.get("linkId"));
		if (Number.isNaN(linkId)) {
			return badRequest({ error: "Invalid link ID" });
		}

		const deleteResult = await tryDeleteCourseActivityModuleLink(
			payload,
			request,
			linkId,
		);

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Link deleted successfully" });
	}

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

		if (Number.isNaN(userId)) {
			return badRequest({ error: "Invalid user ID" });
		}

		if (!role || !status) {
			return badRequest({ error: "Role and status are required" });
		}

		const createResult = await tryCreateEnrollment({
			payload,
			user: userId,
			course: courseId,
			role,
			status,
			authenticatedUser: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
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
			authenticatedUser: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
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

		const deleteResult = await tryDeleteEnrollment(
			payload,
			enrollmentId,
			{
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			request,
			false,
		);

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

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
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
	const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(
		null,
	);
	const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<
		number | null
	>(null);

	if ("error" in loaderData) {
		return (
			<Container size="lg" py="xl">
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="red">{loaderData.error}</Text>
				</Paper>
			</Container>
		);
	}

	const { course, currentUser, availableModules } = loaderData;

	const canEdit =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		course.enrollments.some(
			(enrollment) => enrollment.userId === currentUser.id,
		);

	const handleDeleteLink = (linkId: number) => {
		fetcher.submit(
			{ intent: "delete", linkId: linkId.toString() },
			{ method: "post" },
		);
	};

	const handleCreateLink = (activityModuleId: number) => {
		fetcher.submit(
			{ intent: "create", activityModuleId: activityModuleId.toString() },
			{ method: "post" },
		);
	};

	// Enrollment handlers
	const handleEnrollUsers = () => {
		if (selectedUsers.length > 0 && selectedRole && selectedStatus) {
			// Submit each user enrollment
			selectedUsers.forEach((user) => {
				fetcher.submit(
					{
						intent: "enroll",
						userId: user.id.toString(),
						role: selectedRole,
						status: selectedStatus,
					},
					{ method: "post" },
				);
			});
			closeEnrollModal();
			setSelectedUsers([]);
			setSelectedRole(null);
			setSelectedStatus(null);
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
		openEditModal();
	};

	const handleUpdateEnrollment = () => {
		if (editingEnrollment && selectedRole && selectedStatus) {
			fetcher.submit(
				{
					intent: "edit-enrollment",
					enrollmentId: editingEnrollment.id.toString(),
					role: selectedRole,
					status: selectedStatus,
				},
				{ method: "post" },
			);
			closeEditModal();
			setEditingEnrollment(null);
			setSelectedRole(null);
			setSelectedStatus(null);
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
	const enrolledUserIds = course.enrollments.map((enrollment: any) =>
		typeof enrollment.user === "object" ? enrollment.user.id : enrollment.user,
	);

	return (
		<Container size="lg" py="xl">
			<title>{`${course.title} | Paideia LMS`}</title>
			<meta name="description" content={course.description} />
			<meta property="og:title" content={`${course.title} | Paideia LMS`} />
			<meta property="og:description" content={course.description} />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Group gap="sm" mb="xs">
							<Title order={1}>{course.title}</Title>
							<Badge color={getStatusBadgeColor(course.status)} size="lg">
								{getStatusLabel(course.status)}
							</Badge>
						</Group>
						<Text c="dimmed" size="sm">
							{course.slug}
						</Text>
					</div>
					{canEdit && (
						<Button
							component={Link}
							to={`/course/${course.id}/settings`}
							leftSection={<IconEdit size={16} />}
						>
							Edit Course
						</Button>
					)}
				</Group>

				<CourseInfo
					course={{
						id: course.id,
						title: course.title,
						slug: course.slug,
						description: course.description,
						status: course.status,
						createdBy: course.createdBy
							? `${course.createdBy.firstName || ""} ${course.createdBy.lastName || ""}`.trim() ||
								course.createdBy.email
							: "Unknown",
						createdById: course.createdBy.id,
						createdAt: course.createdAt,
						updatedAt: course.updatedAt,
						enrollmentCount: course.enrollments.length,
					}}
				/>

				<ActivityModulesSection
					existingLinks={course.moduleLinks.map((link) => ({
						id: link.id,
						activityModule: {
							id: String(link.activityModule.id),
							title: link.activityModule.title || "",
							type: link.activityModule.type,
							status: link.activityModule.status,
							description: link.activityModule.description,
						},
						createdAt: link.createdAt,
					}))}
					availableModules={availableModules}
					canEdit={canEdit}
					fetcherState={fetcher.state}
					onAddModule={handleCreateLink}
					onDeleteLink={handleDeleteLink}
				/>

				<EnrollmentsSection
					enrollments={course.enrollments as any[]}
					currentUserRole={currentUser.role || "student"}
					fetcherState={fetcher.state}
					onOpenEnrollModal={openEnrollModal}
					onEditEnrollment={handleEditEnrollment}
					onDeleteEnrollment={handleDeleteEnrollment}
				/>
			</Stack>

			<EnrollUserModal
				opened={enrollModalOpened}
				onClose={closeEnrollModal}
				selectedUsers={selectedUsers}
				onSelectedUsersChange={setSelectedUsers}
				selectedRole={selectedRole}
				onSelectedRoleChange={setSelectedRole}
				selectedStatus={selectedStatus}
				onSelectedStatusChange={setSelectedStatus}
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
				fetcherState={fetcher.state}
				onUpdateEnrollment={handleUpdateEnrollment}
			/>

			<DeleteEnrollmentModal
				opened={deleteModalOpened}
				onClose={closeDeleteModal}
				fetcherState={fetcher.state}
				onConfirmDelete={handleConfirmDeleteEnrollment}
			/>
		</Container>
	);
}
