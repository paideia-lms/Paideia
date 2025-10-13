import { Button, Checkbox, Group, Paper, Stack, Text } from "@mantine/core";
import type { FetcherWithComponents } from "react-router";
import { type ImageFile, RichTextEditor } from "~/components/rich-text-editor";

interface NoteFormProps {
	content: string;
	setContent: (content: string) => void;
	isPublic: boolean;
	setIsPublic: (isPublic: boolean) => void;
	handleImageAdd: (imageFile: ImageFile) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onCancel: () => void;
	fetcher: FetcherWithComponents<{
		error?: string;
	}>;
	submitLabel?: string;
	error?: string;
}

export function NoteForm({
	content,
	setContent,
	isPublic,
	setIsPublic,
	handleImageAdd,
	onSubmit,
	onCancel,
	fetcher,
	submitLabel = "Create Note",
	error,
}: NoteFormProps) {
	return (
		<fetcher.Form method="post" onSubmit={onSubmit}>
			<Paper withBorder shadow="md" p="xl" radius="md">
				<Stack gap="lg">
					<div>
						<Text size="sm" fw={500} mb="xs">
							Content
						</Text>
						<RichTextEditor
							placeholder="Write your note here..."
							content={content}
							onChange={setContent}
							onImageAdd={handleImageAdd}
						/>
					</div>

					<Checkbox
						label="Make this note public"
						description="Public notes can be viewed by other users"
						checked={isPublic}
						onChange={(event) => setIsPublic(event.currentTarget.checked)}
					/>

					{(error || fetcher.data?.error) && (
						<Text c="red" size="sm">
							{error || fetcher.data?.error}
						</Text>
					)}

					<Group justify="flex-end" gap="md">
						<Button variant="subtle" onClick={onCancel} type="button">
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!content.trim() || fetcher.state !== "idle"}
							loading={fetcher.state !== "idle"}
						>
							{submitLabel}
						</Button>
					</Group>
				</Stack>
			</Paper>
		</fetcher.Form>
	);
}
