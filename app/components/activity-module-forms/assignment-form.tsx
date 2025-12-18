import {
	Button,
	Checkbox,
	Input,
	MultiSelect,
	NumberInput,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
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
import type { AssignmentFormInitialValues as NewAssignmentFormInitialValues } from "app/routes/user/module/new";
import type {
	AssignmentFormInitialValues as EditAssignmentFormInitialValues,
} from "app/routes/user/module/edit-setting";
import type { Simplify, UnionToIntersection } from "type-fest";


type AssignmentFormData = Simplify<UnionToIntersection<NewAssignmentFormInitialValues | EditAssignmentFormInitialValues>>

interface AssignmentFormProps {
	initialValues?: Partial<AssignmentFormData>;
	onSubmit: (values: AssignmentFormData) => void;
	isLoading?: boolean;
}

const useAssignmentForm = (initialValues: Partial<AssignmentModuleFormValues>) => {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			status: initialValues?.status || "draft",
			assignmentInstructions: initialValues?.assignmentInstructions || "",
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

	return form
}

export function AssignmentForm({
	initialValues,
	onSubmit,
	isLoading,
}: AssignmentFormProps) {
	const form = useAssignmentForm(initialValues ?? {});
	const requireFileSubmission = useFormWatchForceUpdate(
		form,
		"assignmentRequireFileSubmission",
	);

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

				<Select
					{...form.getInputProps("status")}
					key={form.key("status")}
					label="Status"
					placeholder="Select status"
					data={[
						{ value: "draft", label: "Draft" },
						{ value: "published", label: "Published" },
						{ value: "archived", label: "Archived" },
					]}
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
	form: UseFormReturnType<AssignmentFormData>;
}) {
	const instructions = useFormWatchForceUpdate(
		form,
		"assignmentInstructions",
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
	form: UseFormReturnType<AssignmentFormData>;
}) {
	const selectedFileTypes = useFormWatchForceUpdate(
		form,
		"assignmentAllowedFileTypes",
	);

	// Get file type details for display
	const fileTypeDetails =
		selectedFileTypes && selectedFileTypes.length > 0
			? presetValuesToFileTypes(selectedFileTypes)
			: [];

	return (
		<Stack gap="md">
			<Title order={5}>File Submission Configuration</Title>

			<MultiSelect
				{...form.getInputProps("assignmentAllowedFileTypes")}
				key={form.key("assignmentAllowedFileTypes")}
				label="Allowed File Types"
				description={`Select file types students can submit. ${fileTypeDetails.length > 0 ? `Selected: ${fileTypeDetails.length} file type(s)` : ""}`}
				placeholder="Select file types"
				data={PRESET_FILE_TYPE_OPTIONS.map((opt) => ({
					value: opt.value,
					label: opt.label,
				}))}
				searchable
				clearable
			/>


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
	);
}
