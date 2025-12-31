import { Button, Stack, Textarea, TextInput, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { useRef } from "react";
import { FileUploader } from "~/components/file-uploader";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import type { FileFormInitialValues as EditFileFormInitialValues } from "app/routes/user/module/edit-setting";
import type { FileFormInitialValues as NewFileFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

/**
 * Generic hook to sync form fields with initialValues when they change.
 * Useful for updating form after loader revalidation.
 *
 * @param form - The Mantine form instance
 * @param initialValues - The initial values object (can be partial)
 * @param fields - Array of field paths to watch and sync
 */
function useSyncFormWithInitialValues<T extends Record<string, unknown>>(
	form: UseFormReturnType<T>,
	initialValues: Partial<T> | undefined,
	fields: Array<keyof T>,
) {
	const prevInitialValuesRef = useRef(initialValues);

	// Check if initialValues changed and update form directly (safe to call during render)
	const currentInitialValues = initialValues;
	const prevInitialValues = prevInitialValuesRef.current;

	// Check each field for changes
	let hasChanges = false;
	for (const field of fields) {
		const currentValue = currentInitialValues?.[field];
		const prevValue = prevInitialValues?.[field];
		const fieldChanged =
			JSON.stringify(currentValue ?? null) !==
			JSON.stringify(prevValue ?? null);
		if (fieldChanged) {
			hasChanges = true;
			break;
		}
	}

	// Update form if any field changed
	if (hasChanges) {
		prevInitialValuesRef.current = currentInitialValues;
		if (currentInitialValues) {
			// Update only the specified fields
			for (const field of fields) {
				const value = currentInitialValues[field];
				if (value !== undefined) {
					// Type assertion needed because form.setFieldValue expects specific path types
					// but we're working with dynamic field paths at runtime
					// @ts-expect-error - Dynamic field paths require runtime type checking
					form.setFieldValue(field as string, value);
				}
			}
		}
	}
}

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
			fileMedia: initialValues?.fileMedia ?? [],
			fileFiles: initialValues?.fileFiles ?? [],
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	// Watch form values to sync with FileUploader
	const files = useFormWatchForceUpdate(
		form,
		"fileFiles",
		({ value, previousValue }) => {
			return JSON.stringify(value) !== JSON.stringify(previousValue);
		},
	);
	const mediaIds = useFormWatchForceUpdate(
		form,
		"fileMedia",
		({ value, previousValue }) => {
			return JSON.stringify(value) !== JSON.stringify(previousValue);
		},
	);

	// Sync form with initialValues when they change (e.g., after loader revalidation)
	useSyncFormWithInitialValues(form, initialValues, ["fileMedia", "fileFiles"]);

	const handleFileUploaderChange = ({
		files: newFiles,
		mediaIds: newMediaIds,
	}: {
		files: File[];
		mediaIds: number[];
	}) => {
		form.setFieldValue("fileFiles", newFiles);
		form.setFieldValue("fileMedia", newMediaIds);
	};

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

				<div>
					<Title order={5} mb="xs">
						Files
					</Title>
					<FileUploader
						existingMedia={existingMedia}
						uploadLimit={uploadLimit}
						allowDeleteUploaded={true}
						onChange={handleFileUploaderChange}
						value={{
							files,
							mediaIds,
						}}
					/>
				</div>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
