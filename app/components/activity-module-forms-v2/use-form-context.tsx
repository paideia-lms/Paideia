import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import {
    Checkbox as MantineCheckbox,
    NumberInput as MantineNumberInput,
    Select as MantineSelect,
    TextInput as MantineTextInput,
    Textarea as MantineTextarea,
} from "@mantine/core";
import { DateTimePicker as MantineDateTimePicker } from "@mantine/dates";
import type { QuizConfig } from "../activity-modules-preview/quiz-config.types";
import type { ActivityModule, Quiz } from "server/payload-types";

// Create form hook contexts
export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts(

    );

// Field components that use context - no form prop needed!

export function TextInputField({ label, placeholder, required, withAsterisk, disabled }: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    withAsterisk?: boolean;
    disabled?: boolean;
}) {
    const field = useFieldContext<string>();
    return (
        <MantineTextInput
            label={label}
            placeholder={placeholder}
            required={required}
            withAsterisk={withAsterisk}
            disabled={disabled}
            value={field.state.value ?? ""}
            onChange={(e) => field.handleChange(e.currentTarget.value)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function TextareaField({ label, placeholder, minRows, autosize }: {
    label?: string;
    placeholder?: string;
    minRows?: number;
    autosize?: boolean;
}) {
    const field = useFieldContext<string>();
    return (
        <MantineTextarea
            label={label}
            placeholder={placeholder}
            minRows={minRows}
            autosize={autosize}
            value={field.state.value ?? ""}
            onChange={(e) => field.handleChange(e.currentTarget.value)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function NumberInputField({ label, placeholder, min }: {
    label?: string;
    placeholder?: string;
    min?: number;
}) {
    const field = useFieldContext<number | undefined>();
    return (
        <MantineNumberInput
            label={label}
            placeholder={placeholder}
            min={min}
            value={field.state.value}
            onChange={(val) => field.handleChange(typeof val === "number" ? val : undefined)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function SelectField({ label, placeholder, data, disabled }: {
    label?: string;
    placeholder?: string;
    data: Array<{ value: string; label: string }>;
    disabled?: boolean;
}) {
    const field = useFieldContext<string | null>();
    return (
        <MantineSelect
            label={label}
            placeholder={placeholder}
            data={data}
            disabled={disabled}
            value={field.state.value}
            onChange={(val) => field.handleChange(val)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function CheckboxField({ label }: { label?: string }) {
    const field = useFieldContext<boolean>();
    return (
        <MantineCheckbox
            label={label}
            checked={field.state.value ?? false}
            onChange={(e) => field.handleChange(e.currentTarget.checked)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function DateTimePickerField({ label, placeholder }: {
    label?: string;
    placeholder?: string;
}) {
    const field = useFieldContext<string | null>();
    return (
        <MantineDateTimePicker
            label={label}
            placeholder={placeholder}
            value={field.state.value}
            onChange={(val) => field.handleChange(val)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

// Create the form hook with pre-bound field components
export const { useAppForm, withFieldGroup, withForm } = createFormHook({
    fieldComponents: {
        TextInputField,
        TextareaField,
        NumberInputField,
        SelectField,
        CheckboxField,
        DateTimePickerField,
    },
    formComponents: {},
    fieldContext,
    formContext,
});




// biome-ignore lint/correctness/useHookAtTopLevel: This will be treeshaken at the production
// biome-ignore lint/correctness/noConstantCondition: This will be treeshaken at the production
const form = false ? useAppForm({
    defaultValues: {
        title: "",
        description: "",
        type: "page" as ActivityModule["type"],
        status: "draft" as ActivityModule["status"],
        requirePassword: false,
        accessPassword: "",
        // Page fields
        pageContent: "",
        // Whiteboard fields
        whiteboardContent: "",
        // Assignment fields
        assignmentInstructions: "",
        assignmentDueDate: {} as unknown as Date | null,
        assignmentMaxAttempts: 1,
        assignmentAllowLateSubmissions:
            false,
        assignmentRequireTextSubmission: false,
        assignmentRequireFileSubmission: false,
        // Quiz fields
        quizInstructions: "",
        quizDueDate: {} as unknown as Date | null,
        quizMaxAttempts: 1,
        quizPoints: 100,
        quizTimeLimit: 60,
        quizGradingType: "automatic" as NonNullable<Quiz["gradingType"]>,
        rawQuizConfig: {} as unknown as QuizConfig | null,
        // Discussion fields
        discussionInstructions: "",
        discussionDueDate: {} as unknown as Date | null,
        discussionRequireThread: false,
        discussionRequireReplies: false,
        discussionMinReplies: 1,
    },
}) : undefined;

export type FormApi = NonNullable<typeof form>;