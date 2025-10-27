import {
    Button,
    Container,
    Group,
    Paper,
    Stack,
    Text,
    TextInput,
    Textarea,
    Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconX } from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindSectionById } from "server/internal/course-section-management";
import { useUpdateCourseSection } from "~/routes/api/section-update";
import { BadRequestResponse, ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/section-edit";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
    const userSession = context.get(userContextKey);
    const courseContext = context.get(courseContextKey);
    const payload = context.get(globalContextKey).payload;

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;

    const sectionId = Number.parseInt(params.id, 10);
    if (Number.isNaN(sectionId)) {
        throw new BadRequestResponse("Invalid section ID");
    }

    // Get course context to ensure user has access to this course
    if (!courseContext) {
        throw new ForbiddenResponse("Course not found or access denied");
    }

    // Fetch the section with depth to get related data
    const sectionResult = await tryFindSectionById({
        payload,
        sectionId,
        user: {
            ...currentUser,
            avatar: currentUser.avatar?.id,
        },
    });

    if (!sectionResult.ok) {
        throw new ForbiddenResponse("Section not found or access denied");
    }

    const section = sectionResult.value;

    // Ensure the section belongs to the current course
    if (section.course !== courseContext.course.id) {
        throw new ForbiddenResponse("Section does not belong to this course");
    }

    return ok({
        section,
        course: courseContext.course,
    });
};

export default function SectionEditPage({
    loaderData,
}: Route.ComponentProps) {
    const { section, course } = loaderData;
    const { updateSection, isLoading } = useUpdateCourseSection();

    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            title: section.title,
            description: section.description || "",
        },
        validate: {
            title: (value) => {
                if (!value || value.trim().length === 0) {
                    return "Title is required";
                }
                if (value.length > 255) {
                    return "Title must be less than 255 characters";
                }
                return null;
            },
        },
    });

    const handleSubmit = form.onSubmit((values) => {
        updateSection({
            sectionId: section.id,
            title: values.title,
            description: values.description || undefined,
        });
    });

    const title = `Edit ${section.title} | ${course.title} | Paideia LMS`;

    return (
        <Container size="xl" py="xl">
            <title>{title}</title>
            <meta
                name="description"
                content={`Edit ${section.title} section in ${course.title}`}
            />
            <meta property="og:title" content={title} />
            <meta
                property="og:description"
                content={`Edit ${section.title} section in ${course.title}`}
            />

            <Stack gap="xl">
                <Group justify="space-between" align="flex-start">
                    <div>
                        <Title order={1} mb="xs">
                            Edit Section
                        </Title>
                        <Text size="sm" c="dimmed">
                            Update section information
                        </Text>
                    </div>
                </Group>

                <Paper withBorder shadow="sm" p="xl">
                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput
                                label="Section Title"
                                placeholder="Enter section title"
                                required
                                key={form.key("title")}
                                {...form.getInputProps("title")}
                            />

                            <Textarea
                                label="Description"
                                placeholder="Enter section description (optional)"
                                key={form.key("description")}
                                {...form.getInputProps("description")}
                            />

                            <Group justify="flex-end" mt="md">
                                <Button
                                    component={Link}
                                    to={href("/course/section/:id", { id: section.id.toString() })}
                                    variant="light"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    loading={isLoading}
                                    leftSection={<IconCheck size={16} />}
                                >
                                    Save Changes
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </Container>
    );
}

