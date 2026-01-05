import { Button, Stack, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { FormableWhiteboard } from "~/components/form-components/formable-whiteboard";
import type { WhiteboardFormInitialValues as EditWhiteboardFormInitialValues } from "app/routes/user/module/edit-setting";
import type { WhiteboardFormInitialValues as NewWhiteboardFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

type WhiteboardFormData = Simplify<
	UnionToIntersection<
		NewWhiteboardFormInitialValues | EditWhiteboardFormInitialValues
	>
>;

interface WhiteboardFormProps {
	initialValues?: Partial<WhiteboardFormData>;
	onSubmit: (values: WhiteboardFormData) => void;
	isLoading?: boolean;
}

export function WhiteboardForm({
	initialValues,
	onSubmit,
	isLoading,
}: WhiteboardFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			whiteboardContent: initialValues?.whiteboardContent ?? "",
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

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

				<FormableWhiteboard
					form={form}
					formKey={"whiteboardContent"}
					key={form.key("whiteboardContent")}
					label="Whiteboard Canvas"
				/>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
