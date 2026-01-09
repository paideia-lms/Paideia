import { Button, Checkbox, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateQuizResource,
} from "app/routes/user/module/edit-setting/route";
import type { QuizResource } from "./types";
import { FormableSimpleRichTextEditor } from "~/components/form-components/formable-simple-rich-text-editor";

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

	const form = useForm({
		initialValues: {
			title: resource.title || "",
			content: resource.content || "",
			pages: resource.pages || [],
		},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="md">
				<Title order={5}>Resource {resourceIndex + 1}</Title>
				<form
					onSubmit={form.onSubmit((values) => {
						updateQuizResource({
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
			</Stack>
		</Paper>
	);
}
