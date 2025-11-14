import {
	Button,
	Container,
	Divider,
	Group,
	Paper,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseSectionContextKey } from "server/contexts/course-section-context";
import { userContextKey } from "server/contexts/user-context";
import { useDeleteCourseSection } from "~/routes/api/section-delete";
import { useUpdateCourseSection } from "~/routes/api/section-update";
import { ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/section-edit";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseSectionContext = context.get(courseSectionContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get section context from layout
	if (!courseSectionContext) {
		throw new ForbiddenResponse("Section not found or access denied");
	}

	return ok({
		section: courseSectionContext.section,
		course: courseContext.course,
	});
};

export default function SectionEditPage({ loaderData }: Route.ComponentProps) {
	const { section, course } = loaderData;
	const { updateSection, isLoading } = useUpdateCourseSection();
	const { deleteSection, isLoading: isDeleting } = useDeleteCourseSection();

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

	const handleDelete = () => {
		modals.openConfirmModal({
			title: "Delete Section",
			children: (
				<Text size="sm">
					Are you sure you want to delete this section? This action cannot be
					undone. The section must not have any subsections or activity modules.
				</Text>
			),
			labels: { confirm: "Delete", cancel: "Cancel" },
			confirmProps: { color: "red" },
			onConfirm: () => {
				deleteSection({ sectionId: section.id, courseId: course.id });
			},
		});
	};

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
									to={href("/course/section/:sectionId", {
										sectionId: String(section.id),
									})}
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

				{/* Danger Zone */}
				<Paper
					withBorder
					shadow="sm"
					p="xl"
					style={{ borderColor: "var(--mantine-color-red-6)" }}
				>
					<Stack gap="md">
						<div>
							<Title order={3} c="red">
								Danger Zone
							</Title>
							<Text size="sm" c="dimmed" mt="xs">
								Irreversible and destructive actions
							</Text>
						</div>

						<Divider color="red" />

						<Group justify="space-between" align="flex-start">
							<div style={{ flex: 1 }}>
								<Text fw={500} mb="xs">
									Delete this section
								</Text>
								<Text size="sm" c="dimmed">
									Once you delete a section, there is no going back. Please be
									certain. The section must not have any subsections or activity
									modules to be deleted.
								</Text>
							</div>
							<Button
								color="red"
								variant="light"
								leftSection={<IconTrash size={16} />}
								onClick={handleDelete}
								loading={isDeleting}
								style={{ minWidth: "150px" }}
							>
								Delete Section
							</Button>
						</Group>
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
