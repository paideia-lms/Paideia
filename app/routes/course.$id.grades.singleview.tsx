import {
    Anchor,
    Badge,
    Group,
    Paper,
    ScrollArea,
    Select,
    Stack,
    Table,
    Text,
    Title,
} from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useQueryState } from "nuqs";
import { createLoader, parseAsInteger } from "nuqs/server";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type { SingleUserGradesJsonRepresentation } from "server/internal/user-grade-management";
import { tryGetAdjustedSingleUserGradesJsonRepresentation } from "server/internal/user-grade-management";
import { getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades.singleview";
import { href, Link } from "react-router";

dayjs.extend(utc);
dayjs.extend(timezone);

// Define search params for user selection
export const singleViewSearchParams = {
    userId: parseAsInteger,
};

export const loadSearchParams = createLoader(singleViewSearchParams);

export const loader = async ({
    context,
    params,
    request,
}: Route.LoaderArgs) => {
    const { payload, hints } = context.get(globalContextKey);
    const courseContext = context.get(courseContextKey);
    const { courseId } = params;
    const userSession = context.get(userContextKey);
    const timeZone = hints.timeZone;

    // Get course view data using the course context
    if (!courseContext) {
        throw new ForbiddenResponse("Course not found or access denied");
    }

    // Prepare user object for internal functions
    const currentUser =
        userSession?.isAuthenticated
            ? userSession.effectiveUser || userSession.authenticatedUser
            : null;

    const user = currentUser
        ? {
            ...currentUser,
            avatar:
                typeof currentUser.avatar === "object" && currentUser.avatar !== null
                    ? currentUser.avatar.id
                    : currentUser.avatar,
            collection: "users" as const,
        }
        : null;

    // Get selected user from search params
    const { userId } = loadSearchParams(request);

    // Fetch single user grades if userId is provided
    let singleUserGrades = null;
    if (userId) {
        // Find enrollment for the selected user
        const enrollment = courseContext.course.enrollments.find(
            (e) => e.userId === userId,
        );

        if (enrollment) {
            const singleUserGradesResult =
                await tryGetAdjustedSingleUserGradesJsonRepresentation({
                    payload,
                    user,
                    req: request,
                    overrideAccess: false,
                    courseId: Number(courseId),
                    enrollmentId: enrollment.id,
                });

            if (singleUserGradesResult.ok) {
                singleUserGrades = singleUserGradesResult.value;
            }
        }
    }

    return {
        course: courseContext.course,
        enrollments: courseContext.course.enrollments,
        singleUserGrades,
        selectedUserId: userId,
        timeZone,
    };
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
    return <DefaultErrorBoundary error={error} />;
};

export default function CourseGradesSingleViewPage({
    loaderData,
}: Route.ComponentProps) {
    const { enrollments, singleUserGrades, selectedUserId: _selectedUserId } =
        loaderData;

    const [selectedUserId, setSelectedUserId] = useQueryState(
        "userId",
        parseAsInteger.withOptions({
            shallow: false,
        }),
    );

    // Prepare user select options
    const userOptions = enrollments.map((enrollment) => ({
        value: enrollment.userId.toString(),
        label: enrollment.name || enrollment.email,
    }));

    return (
        <Stack gap="lg">
            <Paper withBorder shadow="sm" p="lg" radius="md">
                <Stack gap="md">
                    <Title order={3}>Single User Grade View</Title>
                    <Select
                        label="Select User"
                        placeholder="Choose a user to view their grade JSON representation"
                        data={userOptions}
                        value={selectedUserId?.toString() || null}
                        onChange={(value) => {
                            setSelectedUserId(value ? Number(value) : null);
                        }}
                        searchable
                        clearable
                    />
                </Stack>
            </Paper>

            {!selectedUserId && (
                <Paper withBorder shadow="sm" p="xl" radius="md">
                    <Text c="dimmed" ta="center">
                        Select a user from the dropdown above to view their grade JSON
                        representation.
                    </Text>
                </Paper>
            )}

            {singleUserGrades && (
                <SingleUserGradeTableView
                    data={singleUserGrades}
                    timeZone={loaderData.timeZone}
                />
            )}
        </Stack>
    );
}


const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case "graded":
            return "green";
        case "submitted":
            return "blue";
        case "draft":
            return "gray";
        default:
            return "gray";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case "graded":
            return "Graded";
        case "submitted":
            return "Submitted";
        case "draft":
            return "Draft";
        default:
            return status;
    }
};

const formatDate = (dateString: string | null | undefined, timeZone?: string) => {
    if (!dateString) return "-";
    try {
        if (timeZone) {
            return dayjs(dateString).tz(timeZone).format("MMM DD, YYYY h:mm A");
        }
        return dayjs(dateString).format("MMM DD, YYYY h:mm A");
    } catch {
        return dateString;
    }
};

function SingleUserGradeTableView({
    data,
    timeZone,
}: {
    data: SingleUserGradesJsonRepresentation;
    timeZone?: string;
}) {
    const { enrollment, course_id } = data;


    return (
        <Stack gap="lg">
            {/* User Summary Card */}
            <Paper withBorder shadow="sm" p="lg" radius="md">
                <Stack gap="md">
                    <Title order={4}>Student Information</Title>
                    <Group gap="xl">
                        <div>
                            <Text size="sm" c="dimmed">
                                Name
                            </Text>
                            <Anchor size="md" fw={500} component={Link} to={href('/course/:courseId/participants/profile', { courseId: course_id.toString() }) + `?userId=${enrollment.user_id}`}>
                                {enrollment.user_name}
                            </Anchor>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">
                                Email
                            </Text>
                            <Text size="md" fw={500}>
                                {enrollment.user_email}
                            </Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">
                                Final Grade
                            </Text>
                            <Text size="lg" fw={700}>
                                {enrollment.final_grade !== null &&
                                    enrollment.final_grade !== undefined
                                    ? enrollment.final_grade.toFixed(2)
                                    : "-"}
                            </Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">
                                Total Weight
                            </Text>
                            <Text size="md" fw={500}>
                                {enrollment.total_weight.toFixed(2)}%
                            </Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">
                                Graded Items
                            </Text>
                            <Text size="md" fw={500}>
                                {enrollment.graded_items} / {enrollment.items.length}
                            </Text>
                        </div>
                    </Group>
                </Stack>
            </Paper>

            {/* Grades Table */}
            <Paper withBorder shadow="sm" p="lg" radius="md">
                <Stack gap="md">
                    <Title order={4}>Grade Items</Title>
                    <ScrollArea>
                        <Table striped highlightOnHover withColumnBorders>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Item Name</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Category</Table.Th>
                                    <Table.Th>Weight</Table.Th>
                                    <Table.Th>Max Grade</Table.Th>
                                    <Table.Th>Base Grade</Table.Th>
                                    <Table.Th>Override Grade</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Feedback</Table.Th>
                                    <Table.Th>Graded At</Table.Th>
                                    <Table.Th>Submitted At</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {enrollment.items.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={11}>
                                            <Text c="dimmed" ta="center" py="xl">
                                                No grade items found.
                                            </Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : (
                                    enrollment.items.map((item) => (
                                        <Table.Tr key={item.item_id}>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>
                                                    {item.item_name}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs" wrap="nowrap">
                                                    {item.item_type !== "manual_item" &&
                                                        getModuleIcon(item.item_type)}
                                                    <Text size="sm" tt="capitalize">
                                                        {item.item_type === "manual_item"
                                                            ? "Manual Item"
                                                            : item.item_type}
                                                    </Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">
                                                    {item.category_name || "-"}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">
                                                    {item.weight.toFixed(2)}%
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{item.max_grade}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                {item.base_grade !== null ? (
                                                    <Text size="sm" fw={500}>
                                                        {item.base_grade}
                                                    </Text>
                                                ) : (
                                                    <Text size="sm" c="dimmed">
                                                        -
                                                    </Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                {item.is_overridden &&
                                                    item.override_grade !== null ? (
                                                    <Text size="sm" fw={500} c="orange">
                                                        {item.override_grade}
                                                    </Text>
                                                ) : (
                                                    <Text size="sm" c="dimmed">
                                                        -
                                                    </Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    color={getStatusBadgeColor(
                                                        item.status,
                                                    )}
                                                    variant="light"
                                                    size="sm"
                                                >
                                                    {getStatusLabel(item.status)}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                {item.feedback ? (
                                                    <Text size="sm" lineClamp={2}>
                                                        {item.feedback}
                                                    </Text>
                                                ) : (
                                                    <Text size="sm" c="dimmed">
                                                        -
                                                    </Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">
                                                    {formatDate(item.graded_at, timeZone)}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">
                                                    {formatDate(item.submitted_at, timeZone)}
                                                </Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))
                                )}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>

                    {/* Adjustments Section */}
                    {enrollment.items.some(
                        (item) => item.adjustments && item.adjustments.length > 0,
                    ) && (
                            <Stack gap="md" mt="md">
                                <Title order={5}>Grade Adjustments</Title>
                                {enrollment.items.map((item) => {
                                    if (
                                        !item.adjustments ||
                                        item.adjustments.length === 0
                                    ) {
                                        return null;
                                    }

                                    return (
                                        <Paper
                                            key={item.item_id}
                                            withBorder
                                            p="md"
                                            radius="md"
                                        >
                                            <Stack gap="xs">
                                                <Text size="sm" fw={600}>
                                                    {item.item_name}
                                                </Text>
                                                {item.adjustments.map((adjustment, idx) => (
                                                    <Group
                                                        key={`${item.item_id}-adjustment-${idx}-${adjustment.reason}`}
                                                        justify="space-between"
                                                        gap="md"
                                                    >
                                                        <div>
                                                            <Text size="sm">
                                                                {adjustment.reason}
                                                            </Text>
                                                            <Text size="xs" c="dimmed">
                                                                {adjustment.is_active
                                                                    ? "Active"
                                                                    : "Inactive"}
                                                            </Text>
                                                        </div>
                                                        <Badge
                                                            color={
                                                                adjustment.points >= 0
                                                                    ? "green"
                                                                    : "red"
                                                            }
                                                            variant="light"
                                                        >
                                                            {adjustment.points >= 0
                                                                ? "+"
                                                                : ""}
                                                            {adjustment.points} points
                                                        </Badge>
                                                    </Group>
                                                ))}
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        )}
                </Stack>
            </Paper>
        </Stack>
    );
}

