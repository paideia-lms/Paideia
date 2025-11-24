import { Button, Stack, Textarea, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { useRef } from "react";
import type {
	ActivityModuleFormValues,
	FileModuleFormValues,
} from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { FileUploader } from "~/components/file-uploader";
import { CommonFields } from "./common-fields";

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

interface FileFormProps {
	initialValues?: Partial<FileModuleFormValues>;
	onSubmit: (values: FileModuleFormValues) => void;
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
	const form = useForm<FileModuleFormValues>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			type: "file" as const,
			status: initialValues?.status || "draft",
			fileMedia: initialValues?.fileMedia || [],
			fileFiles: initialValues?.fileFiles || [],
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	// Watch form values to sync with FileUploader
	const files = useFormWatchForceUpdate(form, "fileFiles", (({ value, previousValue }) => {
		return JSON.stringify(value) !== JSON.stringify(previousValue);
	}));
	const mediaIds = useFormWatchForceUpdate(form, "fileMedia", (({ value, previousValue }) => {
		return JSON.stringify(value) !== JSON.stringify(previousValue);
	}));

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
				<CommonFields
					form={form as UseFormReturnType<ActivityModuleFormValues>}
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
