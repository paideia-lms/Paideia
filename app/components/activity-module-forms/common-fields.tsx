import { Select, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";

interface CommonFieldsProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function CommonFields({ form }: CommonFieldsProps) {
	return (
		<>
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
		</>
	);
}
