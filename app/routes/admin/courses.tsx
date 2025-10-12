import {
    Badge,
    Box,
    Button,
    Container,
    Group,
    Pagination,
    Paper,
    Stack,
    Table,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryFindAllCourses } from "server/internal/course-management";
import type { Course } from "server/payload-types";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/courses";

// Define search params
export const coursesSearchParams = {
    query: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(coursesSearchParams);

export const loader = async ({ request, context }: Route.LoaderArgs) => {
    const payload = context.get(globalContextKey).payload;
    const { user: currentUser } = await payload.auth({
        headers: request.headers,
        canSetHeaders: true,
    });

    if (!currentUser) {
        throw new ForbiddenResponse("Unauthorized");
    }

    if (currentUser.role !== "admin") {
        throw new ForbiddenResponse("Only admins can view all courses");
    }

    // Get search params from URL
    const { query, page } = loadSearchParams(request);

    // Fetch courses with search and pagination
    const coursesResult = await tryFindAllCourses({
        payload,
        query: query || undefined,
        limit: 10,
        page,
        sort: "-createdAt",
    });

    if (!coursesResult.ok) {
        return badRequest({
            courses: [],
            totalCourses: 0,
            totalPages: 0,
            currentPage: 1,
            error: coursesResult.error.message,
        });
    }

    const courses = coursesResult.value.docs.map((course) => {
        const createdBy = course.createdBy;
        const createdByName =
            typeof createdBy === "object" && createdBy !== null
                ? `${createdBy.firstName || ""} ${createdBy.lastName || ""}`.trim() ||
                createdBy.email
                : "Unknown";

        return {
            id: course.id,
            title: course.title,
            slug: course.slug,
            description: course.description,
            status: course.status,
            createdBy: createdByName,
            createdAt: course.createdAt,
        };
    });

    return {
        courses,
        totalCourses: coursesResult.value.totalDocs,
        totalPages: coursesResult.value.totalPages,
        currentPage: coursesResult.value.page,
    };
};

export default function CoursesPage({ loaderData }: Route.ComponentProps) {
    const { courses, totalCourses, totalPages, currentPage } = loaderData;
    const [searchParams, setSearchParams] = useSearchParams();

    // Get current query from URL
    const urlQuery = searchParams.get("query") || "";

    // Local search state for immediate UI updates
    const [searchQuery, setSearchQuery] = useState(urlQuery);

    // Debounce the search query
    const [debouncedQuery] = useDebouncedValue(searchQuery, 500);

    // Update URL when debounced query changes
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);
        if (debouncedQuery) {
            newParams.set("query", debouncedQuery);
        } else {
            newParams.delete("query");
        }
        // Reset to page 1 when search changes
        newParams.set("page", "1");
        setSearchParams(newParams, { replace: true });
    }, [debouncedQuery, searchParams, setSearchParams]);

    // Handle page change
    const handlePageChange = (page: number) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("page", page.toString());
        setSearchParams(newParams);
    };

    const getStatusBadgeColor = (status: Course["status"]) => {
        switch (status) {
            case "published":
                return "green";
            case "draft":
                return "yellow";
            case "archived":
                return "gray";
            default:
                return "gray";
        }
    };

    const getStatusLabel = (status: Course["status"]) => {
        switch (status) {
            case "published":
                return "Published";
            case "draft":
                return "Draft";
            case "archived":
                return "Archived";
            default:
                return status;
        }
    };

    return (
        <Container size="xl" py="xl">
            <title>Courses | Admin | Paideia LMS</title>
            <meta name="description" content="Manage courses in Paideia LMS" />
            <meta property="og:title" content="Courses | Admin | Paideia LMS" />
            <meta property="og:description" content="Manage courses in Paideia LMS" />

            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={1}>Courses</Title>
                        <Text c="dimmed" size="sm">
                            Manage all courses in the system ({totalCourses} total)
                        </Text>
                    </div>
                    <Button
                        component={Link}
                        to="/course/new"
                        leftSection={<IconPlus size={16} />}
                    >
                        Add Course
                    </Button>
                </Group>

                <Paper withBorder shadow="sm" p="md" radius="md">
                    <TextInput
                        placeholder="Search by title, slug, description, or use status:published..."
                        leftSection={<IconSearch size={16} />}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.currentTarget.value)}
                        mb="md"
                    />

                    <Box style={{ overflowX: "auto" }}>
                        <Table striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Title</Table.Th>
                                    <Table.Th>Slug</Table.Th>
                                    <Table.Th>Description</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Created By</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {courses.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={6}>
                                            <Text ta="center" c="dimmed" py="xl">
                                                No courses found
                                            </Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : (
                                    courses.map((course) => (
                                        <Table.Tr key={course.id}>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>
                                                    {course.title}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" c="dimmed">
                                                    {course.slug}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text
                                                    size="sm"
                                                    lineClamp={2}
                                                    style={{ maxWidth: "300px" }}
                                                >
                                                    {course.description}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color={getStatusBadgeColor(course.status)} size="sm">
                                                    {getStatusLabel(course.status)}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{course.createdBy}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <Button
                                                        component={Link}
                                                        to={`/course/view/${course.id}`}
                                                        size="xs"
                                                        variant="light"
                                                    >
                                                        View
                                                    </Button>
                                                    <Button
                                                        component={Link}
                                                        to={`/course/edit/${course.id}`}
                                                        size="xs"
                                                        variant="light"
                                                        color="blue"
                                                    >
                                                        Edit
                                                    </Button>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))
                                )}
                            </Table.Tbody>
                        </Table>
                    </Box>

                    {totalPages > 1 && (
                        <Group justify="center" mt="lg">
                            <Pagination
                                total={totalPages}
                                value={currentPage}
                                onChange={handlePageChange}
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>
        </Container>
    );
}

