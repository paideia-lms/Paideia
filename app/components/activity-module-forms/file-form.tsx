import { Button, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { FormableFileUploader } from "~/components/form-components/formable-file-uploader";
import type { FileFormInitialValues as EditFileFormInitialValues } from "app/routes/user/module/edit-setting/route";
import type { FileFormInitialValues as NewFileFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";
import { useSyncFormWithInitialValues } from "./use-sync-form-with-initial-values";

type FileFormData = Simplify<
	UnionToIntersection<NewFileFormInitialValues | EditFileFormInitialValues>
>;

interface FileFormProps {
	initialValues?: Partial<FileFormData>;
	onSubmit: (values: FileFormData) => void;
	uploadLimit?: number;
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
	uploadLimit,
	existingMedia = [],
	isLoading,
}: FileFormProps) {

	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			files: initialValues?.files ?? { files: [], mediaIds: [] },
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
					existingMedia={existingMedia}
					uploadLimit={uploadLimit}
					allowDeleteUploaded={true}
				/>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
