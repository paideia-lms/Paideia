import type { UseFormReturnType } from "@mantine/form";
import { Input } from "@mantine/core";
import { useFormWatchForceUpdate } from "app/utils/ui/form-utils";
import { FileUploader } from "../file-uploader";
import type { ComponentProps } from "react";
import type { Path } from "@mantine/form/lib/paths.types";

type FileUploaderValue = {
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
 *   formKey={"files"}
 *   key={form.key("files")}
 *   label="Files"
 *   userId={userId}
 *   existingMedia={existingMedia}
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
				existingMedia={existingMedia}
				onChange={({ mediaIds }) => {
					form.setFieldValue(formKey, { mediaIds } as never);
				}}
				value={filesValue as FileUploaderValue | undefined}
				{...fileUploaderProps}
			/>
		</Input.Wrapper>
	);
}
