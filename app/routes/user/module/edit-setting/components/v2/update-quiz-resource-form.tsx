import {
	ActionIcon,
	Button,
	Checkbox,
	Collapse,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useState } from "react";
import {
	useRemoveQuizResource,
	useUpdateQuizResource,
} from "app/routes/user/module/edit-setting/route";
import type { QuizResource } from "./types";
import { FormableSimpleRichTextEditor } from "~/components/form-components/formable-simple-rich-text-editor";

interface RemoveQuizResourceButtonProps {
	moduleId: number;
	resourceId: string;
	nestedQuizId?: string;
}

function RemoveQuizResourceButton({
	moduleId,
	resourceId,
	nestedQuizId,
}: RemoveQuizResourceButtonProps) {
	const { submit: removeQuizResource, isLoading } =
		useRemoveQuizResource();

	return (
		<Button
			color="red"
			variant="subtle"
			leftSection={<IconTrash size={16} />}
			onClick={() => {
				removeQuizResource({
					params: { moduleId },
					values: {
						resourceId,
						nestedQuizId,
					},
				});
			}}
			loading={isLoading}
		>
			Remove
		</Button>
	);
}


interface UpdateQuizResourceFormProps {
	moduleId: number;
	resource: QuizResource;
	resourceIndex: number;
	availablePages: Array<{ id: string; title: string }>;
	nestedQuizId?: string;
}

export function UpdateQuizResourceForm({
	moduleId,
	resource,
	resourceIndex,
	availablePages,
	nestedQuizId,
}: UpdateQuizResourceFormProps) {
	const { submit: updateQuizResource, isLoading } =
		useUpdateQuizResource();
	const [isExpanded, setIsExpanded] = useState(false);

	const form = useForm({
		initialValues: {
			title: resource.title || "",
			content: resource.content || "",
			pages: resource.pages || [],
		},
	});

	return (
		<Paper withBorder p="md" radius="md" w="100%">
			<Stack gap="md">
				<Group justify="space-between" wrap="nowrap">
					<Group gap="xs" style={{ flex: 1 }}>
						<Text fw={500} size="sm">
							Resource {resourceIndex + 1}
						</Text>
						{!isExpanded && form.values.title && (
							<Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
								{form.values.title}
							</Text>
						)}
					</Group>
					<Group gap="xs">
						<ActionIcon
							variant="subtle"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<IconChevronUp size={16} />
							) : (
								<IconChevronDown size={16} />
							)}
						</ActionIcon>
						<RemoveQuizResourceButton
							moduleId={moduleId}
							resourceId={resource.id}
							nestedQuizId={nestedQuizId}
						/>
					</Group>
				</Group>

				<Collapse in={isExpanded}>
					<form
						onSubmit={form.onSubmit(async (values) => {
							await updateQuizResource({
								params: { moduleId },
								values: {
									resourceId: resource.id,
									updates: {
										title: values.title,
										content: values.content,
										pages: values.pages,
									},
									nestedQuizId,
								},
							});
						})}
					>
						<Stack gap="md">
							<TextInput
								{...form.getInputProps("title")}
								label="Resource Title (optional)"
								placeholder="e.g., Reference Material"
							/>

							<FormableSimpleRichTextEditor
								form={form}
								formKey="content"
								label="Content"
								placeholder="Enter resource content..."
							/>

							<div>
								<label htmlFor="pages-selection">Display on Pages</label>
								<p>Select which pages this resource should be visible on</p>
								{availablePages.length === 0 ? (
									<p>No pages available. Add questions to create pages.</p>
								) : (
									<Stack gap="xs">
										{availablePages.map((page, index) => (
											<Checkbox
												key={page.id}
												label={`Page ${index + 1}: ${page.title}`}
												checked={form.values.pages.includes(page.id)}
												onChange={(e) => {
													const currentPages = form.values.pages;
													if (e.currentTarget.checked) {
														form.setFieldValue("pages", [...currentPages, page.id]);
													} else {
														form.setFieldValue(
															"pages",
															currentPages.filter((id) => id !== page.id),
														);
													}
												}}
											/>
										))}
									</Stack>
								)}
							</div>

							<Button type="submit" loading={isLoading}>
								Save Resource
							</Button>
						</Stack>
					</form>
				</Collapse>
			</Stack>
		</Paper>
	);
}
