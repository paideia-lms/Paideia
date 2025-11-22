import {
	Button,
	Checkbox,
	Input,
	MultiSelect,
	NumberInput,
	Paper,
	Stack,
	Text,
	Textarea,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type {
	ActivityModuleFormValues,
	AssignmentModuleFormValues,
} from "~/utils/activity-module-schema";
import {
	PRESET_FILE_TYPE_OPTIONS,
	presetValuesToFileTypes,
} from "~/utils/file-types";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import { CommonFields } from "./common-fields";

interface AssignmentFormProps {
	initialValues?: Partial<AssignmentModuleFormValues>;
	onSubmit: (values: AssignmentModuleFormValues) => void;
	isLoading?: boolean;
}

export function AssignmentForm({
	initialValues,
	onSubmit,
	isLoading,
}: AssignmentFormProps) {
	const form = useForm<AssignmentModuleFormValues>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			type: "assignment" as const,
			status: initialValues?.status || "draft",
			assignmentInstructions: initialValues?.assignmentInstructions || "",
			assignmentDueDate: initialValues?.assignmentDueDate || null,
			assignmentMaxAttempts: initialValues?.assignmentMaxAttempts || 1,
			assignmentAllowLateSubmissions:
				initialValues?.assignmentAllowLateSubmissions || false,
			assignmentRequireTextSubmission:
				initialValues?.assignmentRequireTextSubmission || false,
			assignmentRequireFileSubmission:
				initialValues?.assignmentRequireFileSubmission || false,
			assignmentAllowedFileTypes:
				initialValues?.assignmentAllowedFileTypes || [],
			assignmentMaxFileSize: initialValues?.assignmentMaxFileSize || 10,
			assignmentMaxFiles: initialValues?.assignmentMaxFiles || 5,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});
	const requireFileSubmission = useFormWatchForceUpdate(
		form,
		"assignmentRequireFileSubmission" as const,
	);

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

				<Title order={4} mt="md">
					Assignment Settings
				</Title>

				<InstructionsEditor form={form} />

				{/* TODO: move to course module specific settings */}
				{/* <DateTimePicker
				{...form.getInputProps("assignmentDueDate")}
				key={form.key("assignmentDueDate")}
				label="Due Date"
				placeholder="Select due date"
			/> */}

				{/* <NumberInput
				{...form.getInputProps("assignmentMaxAttempts")}
				key={form.key("assignmentMaxAttempts")}
				label="Max Attempts"
				placeholder="Enter max attempts"
				min={1}
			/> */}

				{/* <Checkbox
				{...form.getInputProps("assignmentAllowLateSubmissions", {
					type: "checkbox",
				})}
				key={form.key("assignmentAllowLateSubmissions")}
				label="Allow late submissions"
			/> */}

				<Checkbox
					{...form.getInputProps("assignmentRequireTextSubmission", {
						type: "checkbox",
					})}
					key={form.key("assignmentRequireTextSubmission")}
					label="Require text submission"
				/>

				<Checkbox
					{...form.getInputProps("assignmentRequireFileSubmission", {
						type: "checkbox",
					})}
					key={form.key("assignmentRequireFileSubmission")}
					label="Require file submission"
				/>

				{requireFileSubmission && <FileSubmissionSettings form={form} />}

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}

function InstructionsEditor({
	form,
}: {
	form: UseFormReturnType<AssignmentModuleFormValues>;
}) {
	const instructions = useFormWatchForceUpdate(
		form,
		"assignmentInstructions" as const,
	);

	return (
		<Input.Wrapper label="Instructions">
			<SimpleRichTextEditor
				content={instructions || ""}
				onChange={(content) => {
					form.setFieldValue("assignmentInstructions" as const, content);
				}}
				placeholder="Enter assignment instructions..."
			/>
		</Input.Wrapper>
	);
}

function FileSubmissionSettings({
	form,
}: {
	form: UseFormReturnType<AssignmentModuleFormValues>;
}) {
	const selectedFileTypes = useFormWatchForceUpdate(
		form,
		"assignmentAllowedFileTypes" as const,
	);

	// Get file type details for display
	const fileTypeDetails =
		selectedFileTypes && selectedFileTypes.length > 0
			? presetValuesToFileTypes(selectedFileTypes)
			: [];

	return (
		<Paper withBorder p="md" mt="md">
			<Stack gap="md">
				<Title order={5}>File Submission Configuration</Title>

				<MultiSelect
					{...form.getInputProps("assignmentAllowedFileTypes")}
					key={form.key("assignmentAllowedFileTypes")}
					label="Allowed File Types"
					description="Select file types students can submit"
					placeholder="Select file types"
					data={PRESET_FILE_TYPE_OPTIONS.map((opt) => ({
						value: opt.value,
						label: opt.label,
					}))}
					searchable
					clearable
				/>

				{fileTypeDetails.length > 0 && (
					<Paper withBorder p="sm">
						<Text size="sm" fw={500} mb="xs">
							Selected: {fileTypeDetails.length} file type(s)
						</Text>
						<Text size="xs" c="dimmed">
							{fileTypeDetails.map((ft) => ft.extension).join(", ")}
						</Text>
					</Paper>
				)}

				<NumberInput
					{...form.getInputProps("assignmentMaxFileSize")}
					key={form.key("assignmentMaxFileSize")}
					label="Maximum File Size (MB)"
					description="Maximum size for each uploaded file"
					placeholder="10"
					min={1}
					max={100}
				/>

				<NumberInput
					{...form.getInputProps("assignmentMaxFiles")}
					key={form.key("assignmentMaxFiles")}
					label="Maximum Number of Files"
					description="Maximum number of files students can upload"
					placeholder="5"
					min={1}
					max={20}
				/>
			</Stack>
		</Paper>
	);
}
