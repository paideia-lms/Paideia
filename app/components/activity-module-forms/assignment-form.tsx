import { Checkbox, NumberInput, Stack, Textarea, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { CommonFields } from "./common-fields";

interface AssignmentFormProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
}

export function AssignmentForm({ form }: AssignmentFormProps) {
    return (
        <Stack gap="md">
            <CommonFields form={form} />

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

            <Textarea
                {...form.getInputProps("assignmentInstructions")}
                key={form.key("assignmentInstructions")}
                label="Instructions"
                placeholder="Enter assignment instructions"
                minRows={3}
            />

            <DateTimePicker
                {...form.getInputProps("assignmentDueDate")}
                key={form.key("assignmentDueDate")}
                label="Due Date"
                placeholder="Select due date"
            />

            <NumberInput
                {...form.getInputProps("assignmentMaxAttempts")}
                key={form.key("assignmentMaxAttempts")}
                label="Max Attempts"
                placeholder="Enter max attempts"
                min={1}
            />

            <Checkbox
                {...form.getInputProps("assignmentAllowLateSubmissions", {
                    type: "checkbox",
                })}
                key={form.key("assignmentAllowLateSubmissions")}
                label="Allow late submissions"
            />

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
        </Stack>
    );
}