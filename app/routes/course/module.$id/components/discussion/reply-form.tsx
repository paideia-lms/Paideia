import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useCreateReply } from "../../route";
import type { inferParserType } from "nuqs";
import { loaderSearchParams } from "../../route";
import { useNuqsSearchParams } from "app/utils/search-params-utils";
import { useForm } from "@mantine/form";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";
import { FormableSimpleRichTextEditor } from "app/components/form-components/formable-simple-rich-text-editor";

interface ReplyFormProps {
	moduleLinkId: number;
	threadId: number;
	replyTo?: inferParserType<typeof loaderSearchParams>["replyTo"];
}

export function ReplyForm({
	moduleLinkId,
	threadId,
	replyTo: _replyTo,
}: ReplyFormProps) {
	const initialValues = {
		content: "",
	};
	const form = useForm({ initialValues });
	useFormWithSyncedInitialValues(form, initialValues);
	const { submit: createReply, isLoading: isSubmitting } = useCreateReply();
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

	return (
		<Paper withBorder p="md" radius="sm" bg="gray.0">
			<form
				onSubmit={form.onSubmit(async ({ content }) => {
					await createReply({
						params: { moduleLinkId },
						searchParams: {
							replyTo: _replyTo ? Number(_replyTo) : "thread",
						},
						values: {
							content: content.trim(),
							parentThread: threadId,
						},
					});
					setQueryParams({ replyTo: null });
				})}
			>
				<Stack gap="md">
					<Text size="sm" fw={500}>
						Write a reply
					</Text>
					<FormableSimpleRichTextEditor
						form={form}
						formKey={"content"}
						key={form.key("content")}
						label="Reply"
						placeholder="Write your reply..."
					/>
					<Group justify="flex-end">
						<Button
							variant="default"
							onClick={() => setQueryParams({ replyTo: null })}
							loading={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" loading={isSubmitting}>
							Post Reply
						</Button>
					</Group>
				</Stack>
			</form>
		</Paper>
	);
}
