import type { UseFormReturnType } from "@mantine/form";
import { Input } from "@mantine/core";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { FileUploader } from "../file-uploader";
import { getRouteUrl } from "app/utils/search-params-utils";
import type { ComponentProps } from "react";
import type { Path } from "node_modules/@mantine/form/lib/paths.types";

type FileUploaderValue = {
	files: File[];
	mediaIds: number[];
};

type FileUploaderProps = Omit<
	ComponentProps<typeof FileUploader>,
	"onChange" | "value" | "defaultValue" | "existingMedia"
>;

interface FormableFileUploaderProps<T> extends FileUploaderProps {
	form: UseFormReturnType<T>;
	formKey: Path<T>;
	label: string;
	existingMedia?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}>;
}

/**
 * This component is a wrapper around the FileUploader component that is used to edit the content of a form.
 *
 * @usage
 *
 * ```
 * <FormableFileUploader
 *   form={form}
 *   formKey={form.key("files")}
 *   key={form.key("files")}
 *   label="Files"
 *   existingMedia={existingMedia}
 *   uploadLimit={uploadLimit}
 *   allowDeleteUploaded={true}
 * />
 * ```
 */
export function FormableFileUploader<T>({
	form,
	formKey,
	label,
	existingMedia = [],
	...fileUploaderProps
}: FormableFileUploaderProps<T>) {
	const filesValue = useFormWatchForceUpdate(
		form,
		formKey,
		({ value, previousValue }) => {
			return JSON.stringify(value) !== JSON.stringify(previousValue);
		},
	);

	return (
		<Input.Wrapper label={label}>
			<FileUploader
				existingMedia={existingMedia.map((media) => ({
					...media,
					previewUrl: getRouteUrl("/api/media/file/:mediaId", {
						params: { mediaId: media.id.toString() },
						searchParams: {},
					}),
				}))}
				onChange={({ files: newFiles, mediaIds: newMediaIds }) => {
					// console.log("newFiles", newFiles);
					// console.log("newMediaIds", newMediaIds);
					// console.log("formKey", formKey);
					form.setFieldValue(formKey, {
						files: newFiles,
						mediaIds: newMediaIds,
					} as any);
				}}
				value={filesValue as FileUploaderValue | undefined}
				{...fileUploaderProps}
			/>
		</Input.Wrapper>
	);
}
