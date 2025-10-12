import {
    Button,
    Container,
    Group,
    Paper,
    Select,
    Stack,
    Textarea,
    TextInput,
    Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { extractJWT } from "payload";
import { redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import {
    tryFindCourseById,
    tryUpdateCourse,
} from "server/internal/course-management";
import type { Course } from "server/payload-types";
import z from "zod";
import {
    badRequest,
    ForbiddenResponse,
    forbidden,
    ok,
    unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course-edit.$id";

export const loader = async ({
    request,
    context,
    params,
}: Route.LoaderArgs) => {
    const payload = context.get(globalContextKey).payload;
    const { user: currentUser } = await payload.auth({
        headers: request.headers,
        canSetHeaders: true,
    });

    if (!currentUser) {
        throw new ForbiddenResponse("Unauthorized");
    }

    if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
        throw new ForbiddenResponse(
            "Only admins and content managers can edit courses",
        );
    }

    const courseId = Number.parseInt(params.id, 10);
    if (Number.isNaN(courseId)) {
        return badRequest({
            error: "Invalid course ID",
        });
    }

    const courseResult = await tryFindCourseById(payload, courseId);

    if (!courseResult.ok) {
        return badRequest({
            error: courseResult.error.message,
        });
    }

    const course = courseResult.value;

    // Check if user can edit this course
    // Admin can edit any course, content-manager can only edit their own
    if (
        currentUser.role === "content-manager" &&
        course.createdBy.id !== currentUser.id
    ) {
        throw new ForbiddenResponse(
            "Content managers can only edit courses they created",
        );
    }

    // Fetch categories for the dropdown
    const categories = await payload.find({
        collection: "course-categories",
        limit: 100,
        sort: "name",
    });

    const categoryId =
        typeof course.category === "number"
            ? course.category
            : course.category?.id ?? null;

    return {
        success: true,
        course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            description: course.description,
            status: course.status,
            category: categoryId,
        },
        categories: categories.docs.map((cat) => ({
            value: cat.id.toString(),
            label: cat.name,
        })),
    };
};

export const action = async ({
    request,
    context,
    params,
}: Route.ActionArgs) => {
    const payload = context.get(globalContextKey).payload;
    const token = extractJWT({ headers: request.headers, payload });
    if (token === null) {
        return unauthorized({
            success: false,
            error: "Unauthorized",
        });
    }

    const currentUser = await payload
        .auth({
            headers: request.headers,
            canSetHeaders: true,
        })
        .then((res) => res.user);

    if (currentUser === null) {
        return unauthorized({
            success: false,
            error: "Unauthorized",
        });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
        return forbidden({
            success: false,
            error: "Only admins and content managers can edit courses",
        });
    }

    const courseId = Number.parseInt(params.id, 10);
    if (Number.isNaN(courseId)) {
        return badRequest({
            success: false,
            error: "Invalid course ID",
        });
    }

    // Verify user can edit this course
    const courseResult = await tryFindCourseById(payload, courseId);
    if (!courseResult.ok) {
        return badRequest({
            success: false,
            error: courseResult.error.message,
        });
    }

    const course = courseResult.value;
    if (
        currentUser.role === "content-manager" &&
        course.createdBy.id !== currentUser.id
    ) {
        return forbidden({
            success: false,
            error: "Content managers can only edit courses they created",
        });
    }

    try {
        const formData = await request.formData();

        const parsed = z
            .object({
                title: z.string().min(1, "Title is required"),
                slug: z
                    .string()
                    .min(1, "Slug is required")
                    .regex(
                        /^[a-z0-9-]+$/,
                        "Slug must contain only lowercase letters, numbers, and hyphens",
                    ),
                description: z.string().min(1, "Description is required"),
                status: z.enum(["draft", "published", "archived"]),
                category: z.coerce.number().nullish(),
            })
            .safeParse({
                title: formData.get("title"),
                slug: formData.get("slug"),
                description: formData.get("description"),
                status: formData.get("status"),
                category: formData.get("category"),
            });

        if (!parsed.success) {
            return badRequest({
                success: false,
                error: parsed.error.issues[0]?.message ?? "Validation error",
            });
        }

        // Update course
        const updateResult = await tryUpdateCourse(
            payload,
            request,
            courseId,
            {
                title: parsed.data.title,
                description: parsed.data.description,
                status: parsed.data.status,
            },
        );

        if (!updateResult.ok) {
            return badRequest({
                success: false,
                error: updateResult.error.message,
            });
        }

        return ok({
            success: true,
            message: "Course updated successfully",
            id: courseId,
        });
    } catch (error) {
        console.error("Course update error:", error);
        return badRequest({
            success: false,
            error: error instanceof Error ? error.message : "Failed to update course",
        });
    }
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const actionData = await serverAction();

    if (actionData?.success) {
        if (actionData.status === 200) {
            notifications.show({
                title: "Course updated",
                message: "The course has been updated successfully",
                color: "green",
            });
            // Redirect to the course's view page
            throw redirect(`/course/view/${actionData.id}`);
        }
    } else if ("error" in actionData) {
        notifications.show({
            title: "Update failed",
            message: actionData?.error,
            color: "red",
        });
    }
    return actionData;
}

export default function EditCoursePage({ loaderData }: Route.ComponentProps) {
    const fetcher = useFetcher<typeof action>();

    // Initialize form with default values (hooks must be called unconditionally)
    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            title: "error" in loaderData ? "" : loaderData.course.title,
            slug: "error" in loaderData ? "" : loaderData.course.slug,
            description: "error" in loaderData ? "" : loaderData.course.description,
            status: ("error" in loaderData ? "draft" : loaderData.course.status) as Course["status"],
            category: "error" in loaderData ? "" : (loaderData.course.category ? loaderData.course.category.toString() : ""),
        },
        validate: {
            title: (value) => (!value ? "Title is required" : null),
            slug: (value) => {
                if (!value) return "Slug is required";
                if (!/^[a-z0-9-]+$/.test(value)) {
                    return "Slug must contain only lowercase letters, numbers, and hyphens";
                }
                return null;
            },
            description: (value) => (!value ? "Description is required" : null),
            status: (value) => (!value ? "Status is required" : null),
        },
    });

    // Handle error state after all hooks are called
    if ("error" in loaderData) {
        return (
            <Container size="sm" py="xl">
                <Paper withBorder shadow="md" p="xl" radius="md">
                    <Title order={2} mb="md" c="red">
                        Error
                    </Title>
                    <p>{loaderData.error}</p>
                </Paper>
            </Container>
        );
    }

    const { categories } = loaderData;

    const handleSubmit = (values: typeof form.values) => {
        const formData = new FormData();
        formData.append("title", values.title);
        formData.append("slug", values.slug);
        formData.append("description", values.description);
        formData.append("status", values.status ?? "draft");

        if (values.category) {
            formData.append("category", values.category);
        }

        fetcher.submit(formData, {
            method: "POST",
        });
    };

    return (
        <Container size="sm" py="xl">
            <title>Edit Course | Paideia LMS</title>
            <meta name="description" content="Edit course in Paideia LMS" />
            <meta property="og:title" content="Edit Course | Paideia LMS" />
            <meta property="og:description" content="Edit course in Paideia LMS" />

            <Paper withBorder shadow="md" p="xl" radius="md">
                <Title order={2} mb="xl">
                    Edit Course
                </Title>

                <fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack gap="lg">
                        <TextInput
                            {...form.getInputProps("title")}
                            key={form.key("title")}
                            label="Title"
                            placeholder="Introduction to Computer Science"
                            required
                        />

                        <TextInput
                            {...form.getInputProps("slug")}
                            key={form.key("slug")}
                            label="Slug"
                            placeholder="cs-101-spring-2025"
                            required
                            description="Only lowercase letters, numbers, and hyphens"
                            disabled
                        />

                        <Textarea
                            {...form.getInputProps("description")}
                            key={form.key("description")}
                            label="Description"
                            placeholder="Enter course description"
                            required
                            minRows={4}
                            maxRows={8}
                        />

                        <Select
                            {...form.getInputProps("status")}
                            key={form.key("status")}
                            label="Status"
                            placeholder="Select status"
                            required
                            data={[
                                { value: "draft", label: "Draft" },
                                { value: "published", label: "Published" },
                                { value: "archived", label: "Archived" },
                            ]}
                        />

                        <Select
                            {...form.getInputProps("category")}
                            key={form.key("category")}
                            label="Category"
                            placeholder="Select category (optional)"
                            data={categories}
                            clearable
                        />

                        <Group justify="flex-end" mt="md">
                            <Button
                                type="submit"
                                loading={fetcher.state !== "idle"}
                                disabled={fetcher.state !== "idle"}
                            >
                                Update Course
                            </Button>
                        </Group>
                    </Stack>
                </fetcher.Form>
            </Paper>
        </Container>
    );
}

