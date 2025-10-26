import { Checkbox, Select, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";

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

            <Checkbox
                {...form.getInputProps("requirePassword", { type: "checkbox" })}
                key={form.key("requirePassword")}
                label="Require password to access"
            />

            <RequirePasswordInput form={form} />
        </>
    );
}

function RequirePasswordInput({
    form,
}: {
    form: UseFormReturnType<ActivityModuleFormValues>;
}) {
    const requirePassword = useFormWatchForceUpdate(form, "requirePassword");

    if (!requirePassword) return null;

    return (
        <TextInput
            {...form.getInputProps("accessPassword")}
            key={form.key("accessPassword")}
            label="Access Password"
            placeholder="Enter access password"
        />
    );
}
