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
import { Link, useFetcher, useSearchParams } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import {
    tryCreateCourseActivityModuleLink,
    tryDeleteCourseActivityModuleLink,
    tryFindLinksByCourse,
} from "server/internal/course-activity-module-link-management";
import { trySearchEnrollments, tryCreateEnrollment, tryUpdateEnrollment, tryDeleteEnrollment } from "server/internal/enrollment-management";
import type { Course, Enrollment } from "server/payload-types";
import type { SearchUser } from "~/routes/api/search-users";
import {
    badRequest,
    ForbiddenResponse,
    ok,
    unauthorized,
} from "~/utils/responses";
import { ActivityModulesSection } from "~/components/activity-modules-section";
import { CourseInfo } from "~/components/course-info";
import { DeleteEnrollmentModal } from "~/components/delete-enrollment-modal";
import { EditEnrollmentModal } from "~/components/edit-enrollment-modal";
import { EnrollUserModal } from "~/components/enroll-user-modal";
import { EnrollmentsSection } from "~/components/enrollments-section";
import { getStatusBadgeColor, getStatusLabel } from "~/components/course-view-utils";
import type { Route } from "./+types/course-view.$id";

export const loader = async ({ context, params, request }: Route.LoaderArgs) => {
    const payload = context.get(globalContextKey).payload;
    const courseContext = context.get(courseContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;

    if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
        throw new ForbiddenResponse(
            "Only admins and content managers can view courses",
        );
    }

    const courseId = Number.parseInt(params.id, 10);
    if (Number.isNaN(courseId)) {
        return badRequest({
            error: "Invalid course ID",
        });
    }

    // Course context must be defined, otherwise throw not found response
    if (!courseContext) {
        throw new ForbiddenResponse("Course not found");
    }

    const course = courseContext.course;

    const createdByName = course.createdBy
        ? `${course.createdBy.firstName || ""} ${course.createdBy.lastName || ""}`.trim() ||
        course.createdBy.email
        : "Unknown";

    // Fetch existing course-activity-module links
    const linksResult = await tryFindLinksByCourse(payload, courseId);
    const existingLinks = linksResult.ok ? linksResult.value : [];

    // Fetch available activity modules the user can access
    const modulesResult = await tryGetUserActivityModules(payload, {
        userId: currentUser.id,
        limit: 100,
    });
    const availableModules = modulesResult.ok ? modulesResult.value.docs : [];

    // Fetch enrollments with pagination
    const page = new URL(request.url).searchParams.get("page");
    const currentPage = page ? Number.parseInt(page, 10) : 1;

    const enrollmentsResult = await trySearchEnrollments({
        payload,
        course: courseId,
        limit: 10,
        page: currentPage,
        authenticatedUser: currentUser,
        req: request,
        overrideAccess: false,
    });

    const enrollments = enrollmentsResult.ok ? enrollmentsResult.value : {
        docs: [],
        totalDocs: 0,
        totalPages: 0,
        page: 1,
    };

    return {
        course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            description: course.description,
            status: course.status,
            createdBy: createdByName,
            createdById: course.createdBy.id,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt,
            structure: course.structure,
            enrollmentCount: (course as Course & { enrollments?: { docs: Enrollment[] } }).enrollments?.docs?.length || 0,
        },
        currentUser: {
            id: currentUser.id,
            role: currentUser.role,
        },
        existingLinks,
        availableModules: availableModules.map((module) => ({
            id: module.id,
            title: module.title,
            type: module.type,
            status: module.status,
            description: module.description,
        })),
        enrollments: {
            docs: enrollments.docs,
            totalDocs: enrollments.totalDocs,
            totalPages: enrollments.totalPages,
            currentPage: enrollments.page,
        },
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

    if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
        return unauthorized({
            error: "Only admins and content managers can manage course links",
        });
    }

    const courseId = Number.parseInt(params.id, 10);
    if (Number.isNaN(courseId)) {
        return badRequest({ error: "Invalid course ID" });
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
            const createResult = await tryCreateCourseActivityModuleLink(
                payload,
                request,
                {
                    course: courseId,
                    activityModule: activityModuleId,
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
        const role = formData.get("role") as "student" | "teacher" | "ta" | "manager";
        const status = formData.get("status") as "active" | "inactive" | "completed" | "dropped";

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
            authenticatedUser: currentUser,
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
        const role = formData.get("role") as "student" | "teacher" | "ta" | "manager";
        const status = formData.get("status") as "active" | "inactive" | "completed" | "dropped";

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
            authenticatedUser: currentUser,
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

        const deleteResult = await tryDeleteEnrollment(payload, enrollmentId, currentUser, request, false);

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
    const [searchParams, setSearchParams] = useSearchParams();

    // Modal states
    const [enrollModalOpened, { open: openEnrollModal, close: closeEnrollModal }] = useDisclosure(false);
    const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

    // Form states
    const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
    const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<number | null>(null);

    if ("error" in loaderData) {
        return (
            <Container size="lg" py="xl">
                <Paper withBorder shadow="sm" p="xl" radius="md">
                    <Text c="red">{loaderData.error}</Text>
                </Paper>
            </Container>
        );
    }

    const { course, currentUser, existingLinks, availableModules, enrollments } = loaderData;

    const canEdit =
        currentUser.role === "admin" || currentUser.id === course.createdById;

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

    const handleEditEnrollment = (enrollment: Enrollment) => {
        setEditingEnrollment(enrollment);
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

    const handlePageChange = (page: number) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("page", page.toString());
        setSearchParams(newParams);
    };

    // Get enrolled user IDs for exclusion
    const enrolledUserIds = enrollments.docs.map((enrollment: Enrollment) =>
        typeof enrollment.user === "object" ? enrollment.user.id : enrollment.user
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
                            to={`/course/edit/${course.id}`}
                            leftSection={<IconEdit size={16} />}
                        >
                            Edit Course
                        </Button>
                    )}
                </Group>

                <CourseInfo course={course} />

                <ActivityModulesSection
                    existingLinks={existingLinks}
                    availableModules={availableModules}
                    canEdit={canEdit}
                    fetcherState={fetcher.state}
                    onAddModule={handleCreateLink}
                    onDeleteLink={handleDeleteLink}
                />

                <EnrollmentsSection
                    enrollments={enrollments}
                    currentUserRole={currentUser.role}
                    fetcherState={fetcher.state}
                    onOpenEnrollModal={openEnrollModal}
                    onEditEnrollment={handleEditEnrollment}
                    onDeleteEnrollment={handleDeleteEnrollment}
                    onPageChange={handlePageChange}
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
