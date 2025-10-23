import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import {
    Box,
    Button as MantineButton,
    Checkbox as MantineCheckbox,
    Input,
    Loader,
    NumberInput as MantineNumberInput,
    Select as MantineSelect,
    TextInput as MantineTextInput,
    Textarea as MantineTextarea,
    useMantineColorScheme,
} from "@mantine/core";
import { DateTimePicker as MantineDateTimePicker } from "@mantine/dates";
import type {
    AppState,
    BinaryFiles,
    ExcalidrawImperativeAPI,
    ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { lazy, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import type { QuizConfig } from "../components/activity-modules-preview/quiz-config.types";
import type { ActivityModule, Quiz } from "server/payload-types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useMounted } from "@mantine/hooks";
import { RichTextEditor } from "../components/rich-text-editor";
import { SimpleRichTextEditor } from "../components/simple-rich-text-editor";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
    import('@excalidraw/excalidraw').then((module) => ({
        default: module.Excalidraw,
    })),
);

// Create form hook contexts
export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

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
    const field = useFieldContext<Date | null>();
    return (
        <MantineDateTimePicker
            label={label}
            placeholder={placeholder}
            value={field.state.value ?? undefined}
            onChange={(val) => {
                // Mantine DateTimePicker can return string | null
                const date = val ? new Date(val) : null;
                field.handleChange(date);
            }}
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ") || undefined}
        />
    );
}

export function RichTextEditorField({ label, placeholder, description }: {
    label?: string;
    placeholder?: string;
    description?: string;
}) {
    const field = useFieldContext<string>();

    return (
        <Input.Wrapper
            label={label}
            description={description}
            error={field.state.meta.errors.join(", ") || undefined}
        >
            <RichTextEditor
                content={field.state.value ?? ""}
                placeholder={placeholder}
                onChange={(html: string) => field.handleChange(html)}
            />
        </Input.Wrapper>
    );
}

export function SimpleRichTextEditorField({ label, placeholder, description }: {
    label?: string;
    placeholder?: string;
    description?: string;
}) {
    const field = useFieldContext<string>();

    return (
        <Input.Wrapper
            label={label}
            description={description}
            error={field.state.meta.errors.join(", ") || undefined}
        >
            <SimpleRichTextEditor
                content={field.state.value ?? ""}
                placeholder={placeholder}
                onChange={(html: string) => field.handleChange(html)}
            />
        </Input.Wrapper>
    );
}

export function WhiteboardField({ label, isLoading = false, description }: {
    label?: string;
    isLoading?: boolean;
    description?: string;
}) {
    const field = useFieldContext<string>();
    const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const { colorScheme } = useMantineColorScheme();
    const mounted = useMounted();

    // Parse initial data from field value (memoized to avoid re-parsing on every render)
    const initialData = useMemo((): ExcalidrawInitialDataState => {
        const existingContent = field.state.value;

        if (existingContent && existingContent.trim().length > 0) {
            try {
                const data = JSON.parse(existingContent) as ExcalidrawInitialDataState;
                // Ensure appState has the required structure
                return {
                    ...data,
                    appState: {
                        ...data.appState,
                        collaborators: new Map(),
                    },
                };
            } catch (error: unknown) {
                console.error('Failed to load whiteboard data:', error);
            }
        }

        return {
            appState: {
                collaborators: new Map(),
            },
        };
    }, [field.state.value]);

    // Sync theme with Mantine's color scheme
    useLayoutEffect(() => {
        if (excalidrawRef.current) {
            const theme = colorScheme === 'dark' ? 'dark' : 'light';
            excalidrawRef.current.updateScene({ appState: { theme } });
        }
    }, [colorScheme]);

    // Handler for Excalidraw changes - will be debounced by Tanstack Form listeners
    const handleExcalidrawChange = (
        elements: readonly OrderedExcalidrawElement[],
        appState: AppState,
        files: BinaryFiles
    ) => {
        const data = {
            elements,
            appState,
            files,
        };
        const currentValue = field.state.value;
        const newValue = JSON.stringify(data);
        // if value is the same, don't change it
        if (currentValue === newValue) {
            return;
        }
        field.handleChange(newValue);
    };

    return (
        <Input.Wrapper
            label={label}
            description={description}
            error={field.state.meta.errors.join(", ") || undefined}
        >
            <Box style={{ height: '500px', border: '1px solid #dee2e6' }}>
                {isLoading || !mounted ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                        }}
                    >
                        <Loader />
                    </div>
                ) : (
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                }}
                            >
                                <Loader />
                            </div>
                        }
                    >
                        <Excalidraw
                            excalidrawAPI={(api) => {
                                excalidrawRef.current = api;
                            }}
                            initialData={initialData}
                            onChange={handleExcalidrawChange}
                            theme={colorScheme === 'dark' ? 'dark' : 'light'}
                        />
                    </Suspense>
                )}
            </Box>
        </Input.Wrapper>
    );
}

// Form components that use context - no form prop needed!

export function SubmitButton({
    label = "Submit",
    size = "lg",
    mt = "lg",
    loadingLabel,
    fullWidth = false,
    isLoading = false,
}: {
    label?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    mt?: string | number;
    loadingLabel?: string;
    isLoading?: boolean;
    fullWidth?: boolean;
}) {
    const form = useFormContext();

    return (
        <form.Subscribe selector={(state) => [state.isSubmitting, state.canSubmit]}>
            {([isSubmitting, canSubmit]) => (
                <MantineButton
                    type="submit"
                    size={size}
                    mt={mt}
                    loading={isSubmitting || isLoading}
                    disabled={!canSubmit}
                    fullWidth={fullWidth}
                >
                    {loadingLabel && isSubmitting ? loadingLabel : label}
                </MantineButton>
            )}
        </form.Subscribe>
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
        RichTextEditorField,
        SimpleRichTextEditorField,
        WhiteboardField,
    },
    formComponents: {
        SubmitButton,
    },
    fieldContext,
    formContext,
});




// biome-ignore lint/correctness/useHookAtTopLevel: This will be treeshaken at the production
// biome-ignore lint/correctness/noConstantCondition: This will be treeshaken at the production
const updateModuleForm = false ? useAppForm({
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
    onSubmitMeta: {
        type: "module" as ActivityModule["type"],
        id: 1 as number,
    },
    onSubmit: () => {

    },
}) : undefined;

export type UpdateModuleFormApi = NonNullable<typeof updateModuleForm>;

const createModuleForm = updateModuleForm

export type CreateModuleFormApi = NonNullable<typeof createModuleForm>;