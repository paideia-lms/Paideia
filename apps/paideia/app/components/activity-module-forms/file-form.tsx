import { Button, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { FormableFileUploader } from "~/components/form-components/formable-file-uploader";
import { useSyncFormWithInitialValues } from "./use-sync-form-with-initial-values";

interface FileFormData {
	title: string;
	description: string;
	files: { mediaIds: number[] };
}

interface FileFormProps {
	initialValues?: Partial<FileFormData>;
	onSubmit: (values: FileFormData) => void;
	userId: number;
	existingMedia?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}>;
	isLoading?: boolean;
}

export function FileForm({
	initialValues,
	onSubmit,
	userId,
	existingMedia = [],
	isLoading,
}: FileFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			files: initialValues?.files ?? { mediaIds: [] },
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	// Sync form with initialValues when they change (e.g., after loader revalidation)
	useSyncFormWithInitialValues(form, initialValues, ["files"]);

	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
			<Stack gap="md">
				<TextInput
					{...form.getInputProps("title")}
					key={form.key("title")}
					label="Title"
					placeholder="Enter module title"
					required
					withAsterisk
				/>

				<Textarea
					{...form.getInputProps("description")}
					key={form.key("description")}
					label="Description"
					placeholder="Enter module description"
					minRows={3}
				/>

				<FormableFileUploader
					form={form}
					formKey={"files"}
					key={form.key("files")}
					label="Files"
					userId={userId}
					existingMedia={existingMedia}
					allowDeleteUploaded={true}
				/>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
