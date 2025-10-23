import {
    ActionIcon,
    Box,
    Button,
    Card,
    Checkbox,
    Group,
    Paper,
    Select,
    Stack,
    Tabs,
    Text,
    Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import {
    DndContext,
    DragOverlay,
    type DragEndEvent,
    type DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMounted } from "@mantine/hooks";
import {
    IconChevronDown,
    IconChevronUp,
    IconGripVertical,
    IconPlus,
    IconSeparator,
    IconTrash,
} from "@tabler/icons-react";
import type {
    NestedQuizConfig,
    Question,
    QuestionType,
    QuizConfig,
    QuizPage,
} from "~/components/activity-modules-preview/quiz-config.types";
import type { UpdateModuleFormApi } from "../../hooks/use-form-context";
import { Store, useStore } from "@tanstack/react-store";


// ============================================================================
// TYPES FOR PAGE BREAK
// ============================================================================

type QuestionOrPageBreak =
    | {
        type: "question";
        data: {
            id: string;
            type: QuestionType;
        };
        fieldPath:
        | `rawQuizConfig.pages[${number}].questions[${number}]`
        | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`;
    }
    | { type: "pageBreak"; id: string };

// ============================================================================
// GRADING CONFIG EDITOR
// ============================================================================

interface GradingConfigEditorProps {
    form: UpdateModuleFormApi;
}

export function GradingConfigEditor({ form }: GradingConfigEditorProps) {
    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
                <Title order={5}>Grading Configuration</Title>

                {/* Enable Grading Checkbox */}
                <form.AppField name="rawQuizConfig.grading.enabled">
                    {(field) => <field.CheckboxField label="Enable Grading" />}
                </form.AppField>

                {/* Conditional Grading Options */}
                <form.Subscribe
                    selector={(state) => state.values.rawQuizConfig?.grading?.enabled}
                >
                    {(enabled) =>
                        enabled ? (
                            <>
                                {/* Passing Score */}
                                <form.AppField name="rawQuizConfig.grading.passingScore">
                                    {(field) => (
                                        <field.NumberInputField
                                            label="Passing Score (%)"
                                            placeholder="Minimum percentage to pass (0-100)"
                                            min={0}
                                        />
                                    )}
                                </form.AppField>

                                {/* Show Score to Student */}
                                <form.AppField name="rawQuizConfig.grading.showScoreToStudent">
                                    {(field) => (
                                        <field.CheckboxField label="Show Score to Student Immediately" />
                                    )}
                                </form.AppField>

                                {/* Show Correct Answers */}
                                <form.AppField name="rawQuizConfig.grading.showCorrectAnswers">
                                    {(field) => (
                                        <field.CheckboxField label="Show Correct Answers After Submission" />
                                    )}
                                </form.AppField>
                            </>
                        ) : null
                    }
                </form.Subscribe>
            </Stack>
        </Paper>
    );
}

function NestedGradingConfigEditor({
    form,
    quizIndex,
}: {
    form: UpdateModuleFormApi;
    quizIndex: number;
}) {
    const basePath = `rawQuizConfig.nestedQuizzes[${quizIndex}].grading` as const;

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
                <Title order={5}>Grading Configuration</Title>

                {/* Enable Grading Checkbox */}
                <form.AppField name={`${basePath}.enabled`}>
                    {(field) => <field.CheckboxField label="Enable Grading" />}
                </form.AppField>

                {/* Conditional Grading Options */}
                <form.Subscribe
                    selector={(state) =>
                        state.values.rawQuizConfig?.nestedQuizzes?.[quizIndex]?.grading
                            ?.enabled
                    }
                >
                    {(enabled) =>
                        enabled ? (
                            <>
                                {/* Passing Score */}
                                <form.AppField name={`${basePath}.passingScore`}>
                                    {(field) => (
                                        <field.NumberInputField
                                            label="Passing Score (%)"
                                            placeholder="Minimum percentage to pass (0-100)"
                                            min={0}
                                        />
                                    )}
                                </form.AppField>

                                {/* Show Score to Student */}
                                <form.AppField name={`${basePath}.showScoreToStudent`}>
                                    {(field) => (
                                        <field.CheckboxField label="Show Score to Student Immediately" />
                                    )}
                                </form.AppField>

                                {/* Show Correct Answers */}
                                <form.AppField name={`${basePath}.showCorrectAnswers`}>
                                    {(field) => (
                                        <field.CheckboxField label="Show Correct Answers After Submission" />
                                    )}
                                </form.AppField>
                            </>
                        ) : null
                    }
                </form.Subscribe>
            </Stack>
        </Paper>
    );
}

// ============================================================================
// SCORING EDITOR
// ============================================================================

function ScoringEditor({
    form,
    questionFieldPath,
}: {
    form: UpdateModuleFormApi;
    questionFieldPath:
    | `rawQuizConfig.pages[${number}].questions[${number}]`
    | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`;
}) {
    return (
        <form.Subscribe
            selector={(state) => {
                const { isNestedQuiz, nestedQuizIndex, pageIndex, questionIndex } =
                    getFieldPathIndexes(questionFieldPath);
                const question =
                    nestedQuizIndex !== undefined
                        ? state.values.rawQuizConfig?.nestedQuizzes?.[nestedQuizIndex]
                            ?.pages?.[pageIndex]?.questions?.[questionIndex]
                        : state.values.rawQuizConfig?.pages?.[pageIndex]?.questions?.[
                        questionIndex
                        ];
                if (!question)
                    throw new Error(
                        `ScoringEditor: Question at path ${questionFieldPath} not found`,
                    );
                return question?.type;
            }}
        >
            {(questionType) => {
                if (questionType === "long-answer") {
                    return (
                        <form.AppField name={`${questionFieldPath}.scoring.maxPoints`}>
                            {(field) => (
                                <field.NumberInputField
                                    label="Maximum Points"
                                    placeholder="Maximum points for manual grading"
                                    min={0}
                                />
                            )}
                        </form.AppField>
                    );
                }
                // For multiple-choice and short-answer, use simple scoring
                return (
                    <form.AppField name={`${questionFieldPath}.scoring.points`}>
                        {(field) => (
                            <field.NumberInputField
                                label="Points"
                                placeholder="Points awarded for correct answer"
                                min={0}
                            />
                        )}
                    </form.AppField>
                );
            }}
        </form.Subscribe>
    );
}

// ============================================================================
// MULTIPLE CHOICE EDITOR
// ============================================================================

function MultipleChoiceDeleteButton({
    form,
    questionFieldPath,
    value,
}: {
    form: UpdateModuleFormApi;
    questionFieldPath:
    | `rawQuizConfig.pages[${number}].questions[${number}]`
    | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`;
    value: string;
}) {
    const { isNestedQuiz, questionIndex, pageIndex, nestedQuizIndex } =
        getFieldPathIndexes(questionFieldPath);
    const removeOption = (key: string, isCorrectAnswer: boolean) => {
        form.deleteField(`${questionFieldPath}.options.${key}`);
        if (isCorrectAnswer) {
            form.setFieldValue(`${questionFieldPath}.correctAnswer`, undefined);
        }
    };
    return (
        <form.Subscribe
            selector={(state) => {
                const question =
                    nestedQuizIndex !== undefined
                        ? state.values.rawQuizConfig?.nestedQuizzes?.[nestedQuizIndex]
                            ?.pages?.[pageIndex]?.questions?.[questionIndex]
                        : state.values.rawQuizConfig?.pages?.[pageIndex]?.questions?.[
                        questionIndex
                        ];
                if (!question) {
                    console.error(
                        `MultipleChoiceDeleteButton: Question not found. Question path: ${questionFieldPath}`,
                    );
                    return undefined;
                }
                if (question?.type !== "multiple-choice") {
                    console.error(
                        `MultipleChoiceDeleteButton: Question is not a multiple-choice question. Question path: ${questionFieldPath}`,
                    );
                    return undefined;
                }
                return question.correctAnswer;
            }}
        >
            {(correctAnswer) => (
                <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => removeOption(value, correctAnswer === value)}
                >
                    <IconTrash size={16} />
                </ActionIcon>
            )}
        </form.Subscribe>
    );
}

function MultipleChoiceEditor({
    form,
    questionFieldPath,
}: {
    form: UpdateModuleFormApi;
    questionFieldPath:
    | `rawQuizConfig.pages[${number}].questions[${number}]`
    | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`;
}) {
    return (
        <form.AppField name={`${questionFieldPath}.options`} mode="array">
            {(optionsObjectField) => {
                // Convert options object to array for rendering
                const optionsObject =
                    (optionsObjectField.state.value as Record<string, string>) || {};
                const optionEntries = Object.entries(optionsObject);

                const addOption = () => {
                    const nextKey = String.fromCharCode(97 + optionEntries.length);
                    optionsObjectField.handleChange({
                        ...optionsObject,
                        [nextKey]: "",
                    });
                };

                return (
                    <Stack gap="xs">
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>
                                Answer Options
                            </Text>
                            <Button
                                size="compact-sm"
                                variant="light"
                                leftSection={<IconPlus size={14} />}
                                onClick={addOption}
                            >
                                Add Option
                            </Button>
                        </Group>

                        {optionEntries.map(([key]) => (
                            <Group key={key} gap="xs" wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <form.AppField name={`${questionFieldPath}.options.${key}`}>
                                        {(field) => (
                                            <field.TextInputField
                                                placeholder={`Option ${key.toUpperCase()}`}
                                            />
                                        )}
                                    </form.AppField>
                                </Box>
                                <form.AppField name={`${questionFieldPath}.correctAnswer`}>
                                    {(field) => (
                                        <Checkbox
                                            label="Correct"
                                            checked={field.state.value === key}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.currentTarget.checked ? key : undefined,
                                                )
                                            }
                                        />
                                    )}
                                </form.AppField>
                                <MultipleChoiceDeleteButton
                                    form={form}
                                    questionFieldPath={questionFieldPath}
                                    value={key}
                                />
                            </Group>
                        ))}
                    </Stack>
                );
            }}
        </form.AppField>
    );
}

// ============================================================================
// SORTABLE PAGE BREAK
// ============================================================================

type SortablePageBreakItemProps = {
    id: string;
    onRemove?: () => void;
};

function SortablePageBreakItem({ id, onRemove }: SortablePageBreakItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };
    return (
        <Box ref={setNodeRef} style={style}>
            <Paper withBorder p="sm" radius="md">
                <Group justify="space-between">
                    <Group gap="xs">
                        <ActionIcon {...attributes} {...listeners} variant="subtle">
                            <IconGripVertical size={16} />
                        </ActionIcon>
                        <IconSeparator size={20} />
                        <Text size="sm" c="dimmed" fw={500}>
                            Page Break
                        </Text>
                    </Group>
                    <ActionIcon color="red" variant="subtle" onClick={onRemove}>
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            </Paper>
        </Box>
    );
}

// ============================================================================
// DRAG OVERLAY PREVIEW
// ============================================================================

interface DragOverlayPreviewProps {
    activeItem:
    | { type: "pageBreak" }
    | {
        type: "question";
        id: string;
        questionNumber: number;
        questionTypeLabel: string;
    }
    | null;
}

function DragOverlayPreview({ activeItem }: DragOverlayPreviewProps) {
    if (!activeItem) return null;

    if (activeItem.type === "pageBreak") {
        return (
            <Paper
                withBorder
                p="sm"
                radius="md"
                style={{ cursor: "grabbing" }}
            >
                <Group justify="space-between">
                    <Group gap="xs">
                        <IconGripVertical size={16} />
                        <IconSeparator size={20} />
                        <Text size="sm" c="dimmed" fw={500}>
                            Page Break
                        </Text>
                    </Group>
                </Group>
            </Paper>
        );
    }

    return (
        <Card withBorder radius="md" p="md" style={{ cursor: "grabbing" }}>
            <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" style={{ flex: 1 }}>
                    <IconGripVertical size={16} />
                    <Text fw={500} size="sm">
                        Question {activeItem.questionNumber}: {activeItem.questionTypeLabel}
                    </Text>
                </Group>
            </Group>
        </Card>
    );
}

// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================

function getNestedQuizIndex(
    questionFieldPath:
        | `rawQuizConfig.pages[${number}].questions[${number}]`
        | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`,
): number | undefined {
    const match = questionFieldPath.match(
        /rawQuizConfig\.nestedQuizzes\[(\d+)\]/,
    );
    if (match) {
        return Number.parseInt(match[1], 10);
    }
    return undefined;
}

function getPageIndex(
    questionFieldPath:
        | `rawQuizConfig.pages[${number}].questions[${number}]`
        | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`,
): number {
    const isNestedQuiz = questionFieldPath.includes("nestedQuizzes");
    if (isNestedQuiz) {
        const match = questionFieldPath.match(
            /rawQuizConfig\.nestedQuizzes\[(\d+)\]\.pages\[(\d+)\]/,
        );
        if (match) {
            return Number.parseInt(match[2], 10);
        }
    } else {
        const match = questionFieldPath.match(/rawQuizConfig\.pages\[(\d+)\]/);
        if (match) {
            return Number.parseInt(match[1], 10);
        }
    }
    throw new Error(
        `Page index not found in question field path ${questionFieldPath}`,
    );
}

function getQuestionIndex(
    questionFieldPath:
        | `rawQuizConfig.pages[${number}].questions[${number}]`
        | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`,
): number {
    const isNestedQuiz = questionFieldPath.includes("nestedQuizzes");
    if (isNestedQuiz) {
        const match = questionFieldPath.match(
            /rawQuizConfig\.nestedQuizzes\[(\d+)\]\.pages\[(\d+)\]\.questions\[(\d+)\]/,
        );
        if (match) {
            return Number.parseInt(match[3], 10);
        }
    } else {
        const match = questionFieldPath.match(
            /rawQuizConfig\.pages\[(\d+)\]\.questions\[(\d+)\]/,
        );
        if (match) {
            return Number.parseInt(match[2], 10);
        }
    }
    throw new Error(
        `Question index not found in question field path ${questionFieldPath}`,
    );
}

function getFieldPathIndexes(
    questionFieldPath:
        | `rawQuizConfig.pages[${number}].questions[${number}]`
        | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`,
) {
    const isNestedQuiz = questionFieldPath.includes("nestedQuizzes");
    const nestedQuizIndex = isNestedQuiz
        ? getNestedQuizIndex(questionFieldPath)
        : undefined;
    const pageIndex = getPageIndex(questionFieldPath);
    const questionIndex = getQuestionIndex(questionFieldPath);
    return { isNestedQuiz, nestedQuizIndex, pageIndex, questionIndex };
}

function getQuestionTypeLabel(type: QuestionType) {
    return type === "multiple-choice"
        ? "Multiple Choice"
        : type === "short-answer"
            ? "Short Answer"
            : "Long Answer";
}
interface SortableQuestionItemProps {
    form: UpdateModuleFormApi;
    questionFieldPath:
    | `rawQuizConfig.pages[${number}].questions[${number}]`
    | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`; // e.g., "rawQuizConfig.pages[0].questions[2]"
    id: string;
    /**
     * the question number in the quiz
     */
    questionNumber: number;
    onRemove?: () => void;
}

const store = new Store({
    expandedQuestionIds: {
    } as Record<string, boolean>,
    /** 
     * can be question id or page id 
     */
    activeId: null as string | null,
})

const toggleQuestionExpansion = (id: string) => {
    store.setState((prevState) => ({
        ...prevState,
        expandedQuestionIds: prevState.expandedQuestionIds[id]
            ? { ...prevState.expandedQuestionIds, [id]: false }
            : { ...prevState.expandedQuestionIds, [id]: true },
    }));
}

const setActiveId = (id: string | null) => {
    store.setState((prevState) => ({
        ...prevState,
        activeQuestionId: id,
    }));
}

function SortableQuestionItem({
    form,
    questionFieldPath,
    id,
    onRemove,
    questionNumber,
}: SortableQuestionItemProps) {
    const { isNestedQuiz, nestedQuizIndex, pageIndex, questionIndex } =
        getFieldPathIndexes(questionFieldPath);
    // default to true
    const isExpanded = useStore(store, (state) => state.expandedQuestionIds[id] ?? true);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    function handleQuestionTypeChange({
        type,
        id,
        // prompt,
        // feedback,
    }: Pick<Question, "type" | "id">) {
        if (
            type !== "multiple-choice" &&
            type !== "short-answer" &&
            type !== "long-answer"
        )
            return;

        const prompt = form.getFieldValue(`${questionFieldPath}.prompt`) ?? "";
        const feedback = form.getFieldValue(`${questionFieldPath}.feedback`) ?? "";
        const baseQuestion = {
            id,
            prompt,
            feedback,
            type,
        };

        if (type === "multiple-choice") {
            form.setFieldValue(questionFieldPath, {
                ...baseQuestion,
                type: "multiple-choice",
                options: { a: "Option A", b: "Option B" },
                correctAnswer: "a",
                scoring: { type: "simple", points: 1 },
            });
        } else if (type === "short-answer") {
            form.setFieldValue(questionFieldPath, {
                ...baseQuestion,
                type: "short-answer",
                correctAnswer: "",
                scoring: { type: "simple", points: 1 },
            });
        } else if (type === "long-answer") {
            form.setFieldValue(questionFieldPath, {
                ...baseQuestion,
                type: "long-answer",
                correctAnswer: "",
                scoring: { type: "manual", maxPoints: 1 },
            });
        }
    }

    return (
        <Box ref={setNodeRef} style={style}>
            <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                    {/* Header with drag handle and collapse button */}
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" style={{ flex: 1 }}>
                            <ActionIcon
                                {...attributes}
                                {...listeners}
                                variant="subtle"
                                style={{ cursor: isDragging ? "grabbing" : "grab" }}
                            >
                                <IconGripVertical size={16} />
                            </ActionIcon>
                            <form.Subscribe
                                selector={(state) => {
                                    const question =
                                        nestedQuizIndex !== undefined
                                            ? state.values.rawQuizConfig?.nestedQuizzes?.[
                                                nestedQuizIndex
                                            ]?.pages?.[pageIndex]?.questions?.[questionIndex]
                                            : state.values.rawQuizConfig?.pages?.[pageIndex]
                                                ?.questions?.[questionIndex];
                                    return {
                                        promptValue: question?.prompt,
                                        typeValue: question?.type as QuestionType,
                                    };
                                }}
                            >
                                {({ promptValue, typeValue }) => (
                                    <>
                                        <Text fw={500} size="sm">
                                            Question {questionNumber}:{" "}
                                            {getQuestionTypeLabel(typeValue)}
                                        </Text>
                                        {!isExpanded && promptValue && (
                                            <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                                                {promptValue}
                                            </Text>
                                        )}
                                    </>
                                )}
                            </form.Subscribe>
                        </Group>
                        <Group gap="xs">
                            <ActionIcon
                                variant="subtle"
                                onClick={() => toggleQuestionExpansion(id)}
                            >
                                {isExpanded ? (
                                    <IconChevronUp size={16} />
                                ) : (
                                    <IconChevronDown size={16} />
                                )}
                            </ActionIcon>
                            <ActionIcon color="red" variant="subtle" onClick={onRemove}>
                                <IconTrash size={16} />
                            </ActionIcon>
                        </Group>
                    </Group>

                    {/* Collapsible content */}
                    {isExpanded && (
                        <Stack gap="sm">
                            {/* Question Type Selector */}
                            <form.AppField name={`${questionFieldPath}.type`}>
                                {(field) => (
                                    <Select
                                        label="Question Type"
                                        value={field.state.value}
                                        onChange={(value) =>
                                            handleQuestionTypeChange({
                                                type: value as QuestionType,
                                                id,
                                            })
                                        }
                                        data={[
                                            { value: "multiple-choice", label: "Multiple Choice" },
                                            { value: "short-answer", label: "Short Answer" },
                                            { value: "long-answer", label: "Long Answer" },
                                        ]}
                                        size="sm"
                                    />
                                )}
                            </form.AppField>
                            {/* Question Prompt */}
                            <form.AppField name={`${questionFieldPath}.prompt`}>
                                {(field) => (
                                    <field.TextareaField label="Question Prompt" minRows={2} />
                                )}
                            </form.AppField>

                            {/* Feedback Field */}
                            <form.AppField name={`${questionFieldPath}.feedback`}>
                                {(field) => (
                                    <field.TextareaField
                                        label="Feedback (optional)"
                                        placeholder="Shown to students after answering"
                                        minRows={2}
                                    />
                                )}
                            </form.AppField>

                            {/* Conditional Question Type Fields */}
                            <form.Subscribe
                                selector={(state) => {
                                    const q =
                                        nestedQuizIndex !== undefined
                                            ? state.values.rawQuizConfig?.nestedQuizzes?.[
                                                nestedQuizIndex
                                            ]?.pages?.[pageIndex]?.questions?.[questionIndex]
                                            : state.values.rawQuizConfig?.pages?.[pageIndex]
                                                ?.questions?.[questionIndex];
                                    if (!q)
                                        throw new Error(
                                            `MultipleChoiceEditor: Question at path ${questionFieldPath} not found`,
                                        );
                                    return q.type;
                                }}
                            >
                                {(questionType) => {
                                    if (questionType === "multiple-choice") {
                                        return (
                                            <MultipleChoiceEditor
                                                form={form}
                                                questionFieldPath={questionFieldPath}
                                            />
                                        );
                                    }

                                    if (questionType === "short-answer") {
                                        return (
                                            <form.AppField
                                                name={`${questionFieldPath}.correctAnswer`}
                                            >
                                                {(field) => (
                                                    <field.TextInputField
                                                        label="Correct Answer (optional)"
                                                        placeholder="For automatic grading (exact match)"
                                                    />
                                                )}
                                            </form.AppField>
                                        );
                                    }

                                    if (questionType === "long-answer") {
                                        return (
                                            <form.AppField
                                                name={`${questionFieldPath}.correctAnswer`}
                                            >
                                                {(field) => (
                                                    <field.TextareaField
                                                        label="Sample/Expected Answer (optional)"
                                                        placeholder="For reference purposes (requires manual grading)"
                                                        minRows={3}
                                                    />
                                                )}
                                            </form.AppField>
                                        );
                                    }

                                    return (
                                        <Text c="dimmed">Question type not yet implemented</Text>
                                    );
                                }}
                            </form.Subscribe>

                            {/* Scoring Configuration */}
                            <ScoringEditor
                                form={form}
                                questionFieldPath={questionFieldPath}
                            />
                        </Stack>
                    )}
                </Stack>
            </Card>
        </Box>
    );
}

// ============================================================================
// QUESTIONS LIST WITH DRAG AND DROP
// ============================================================================

interface QuestionsListProps {
    form: UpdateModuleFormApi;
    pagesFieldName:
    | "rawQuizConfig.pages"
    | `rawQuizConfig.nestedQuizzes[${number}].pages`; // e.g., "rawQuizConfig.pages" or "rawQuizConfig.nestedQuizzes[0].pages"
}

// Convert pages structure to flat list with page breaks
const pagesToItems = (
    pages: {
        id: string;
        title: string;
        questions: { id: string; type: QuestionType }[];
    }[],
    pagesFieldName:
        | "rawQuizConfig.pages"
        | `rawQuizConfig.nestedQuizzes[${number}].pages`,
): QuestionOrPageBreak[] => {
    const result: QuestionOrPageBreak[] = [];
    if (!pages || !Array.isArray(pages)) {
        console.error("pagesToItems: pages is not an array", pages);
        return result;
    }

    pages.forEach((page, pageIndex) => {
        // Safety check: ensure questions is an array
        if (!page || !Array.isArray(page.questions)) {
            console.error(
                "pagesToItems: page is not an object or questions is not an array",
                page,
            );
            return;
        }

        page.questions.forEach((question) => {
            const questionIndex = page.questions.indexOf(question);
            result.push({
                type: "question",
                data: question,
                fieldPath: `${pagesFieldName}[${pageIndex}].questions[${questionIndex}]`,
            });
        });

        // Add page break between pages (but not after the last page)
        if (pageIndex < pages.length - 1) {
            result.push({ type: "pageBreak", id: `pageBreak-${pageIndex}` });
        }
    });

    return result;
};

// Convert flat list back to pages structure
const itemsToPages = (
    items: QuestionOrPageBreak[],
): {
    id: string;
    title: string;
    questions: { id: string; type: string }[];
}[] => {
    if (items.length === 0) {
        return [];
    }

    const pages: {
        id: string;
        title: string;
        questions: { id: string; type: string }[];
    }[] = [];
    let currentPage: { id: string; type: string }[] = [];

    items.forEach((item) => {
        if (item.type === "question") {
            currentPage.push(item.data);
        } else if (item.type === "pageBreak") {
            pages.push({
                id: `page-${Date.now()}-${pages.length}`,
                title: `Page ${pages.length + 1}`,
                questions: currentPage,
            });
            currentPage = [];
        }
    });

    // Always add the last page
    pages.push({
        id: `page-${Date.now()}-${pages.length}`,
        title: `Page ${pages.length + 1}`,
        questions: currentPage,
    });

    return pages;
};

// construct the new pages from the simplified pages
function convertSimplifiedPages(
    pages: {
        id: string;
        title: string;
        questions: { id: string; type: string }[];
    }[],
    pages2: QuizPage[],
) {
    const items = pages2.flatMap((page) => page.questions);
    // either a page or a question is removed
    const results: QuizPage[] = pages.map((page) => ({
        id: page.id,
        title: page.title,
        questions: [],
    }));
    // if both array has the page, add to results
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        for (let j = 0; j < page.questions.length; j++) {
            const question = page.questions[j];
            const question2 = items.find((q) => q.id === question.id);
            if (question2) {
                results[i].questions.push(question2);
            }
        }
    }
    return results;
}

function ItemListRenderer({
    form,
    pagesFieldName,
}: {
    form: UpdateModuleFormApi;
    pagesFieldName:
    | "rawQuizConfig.pages"
    | `rawQuizConfig.nestedQuizzes[${number}].pages`;
}) {
    // array mode
    return (
        <form.Field name={pagesFieldName} mode="array">
            {(pageField) => {
                const pages = pageField.state.value ?? [];

                return pages.map((page, index) => (
                    <form.Field
                        key={pages[index].id}
                        name={`${pagesFieldName}[${index}].questions`}
                        mode="array"
                    >
                        {(questionField) => {
                            const questions = questionField.state.value ?? [];

                            function removeQuestion(questionIndex: number) {
                                questionField.removeValue(questionIndex);
                            }
                            // when we delete the page break, it means we are deleting the page
                            // for example, if we have two pages, page 0 and page 1, we have one page break 1
                            // when we delete page break 1, we should delete page 1
                            // all the questions in page 1 should be moved to the page before it
                            function removePageBreak(id: string) {
                                const deletedPage = pageField.state.value?.findIndex(
                                    (page) => page.id === id,
                                );
                                if (deletedPage !== undefined) {
                                    const pageBefore = pageField.state.value?.[deletedPage - 1];
                                    if (!pageBefore)
                                        throw new Error(
                                            "Page before should always exist. If not, it means our logic in the code is wrong.",
                                        );
                                    const questions =
                                        pageField.state.value?.[deletedPage]?.questions ?? [];
                                    for (const q of questions) {
                                        form
                                            .getFieldInfo(
                                                `${pagesFieldName}[${deletedPage - 1}].questions`,
                                            )
                                            ?.instance?.pushValue(q);
                                    }
                                    pageField.removeValue(deletedPage);
                                }
                            }


                            return (
                                <>
                                    {questions.map((question, questionIndex) => {
                                        return (
                                            <form.Subscribe
                                                key={question.id}
                                                selector={(s) => {
                                                    const {
                                                        isNestedQuiz,
                                                        nestedQuizIndex,
                                                        pageIndex,
                                                        questionIndex: qIndex,
                                                    } = getFieldPathIndexes(
                                                        `${pagesFieldName}[${index}].questions[${questionIndex}]`,
                                                    );
                                                    const allPages =
                                                        nestedQuizIndex !== undefined
                                                            ? (s.values.rawQuizConfig?.nestedQuizzes?.[
                                                                nestedQuizIndex
                                                            ]?.pages ?? [])
                                                            : (s.values.rawQuizConfig?.pages ?? []);
                                                    // flat map the page.questions
                                                    const questionNumber =
                                                        allPages
                                                            .flatMap((p) => p.questions)
                                                            .findIndex((q) => q.id === question.id) + 1;
                                                    return questionNumber;
                                                }}
                                            >
                                                {(questionNumber) => {
                                                    return (
                                                        <SortableQuestionItem
                                                            id={question.id}
                                                            form={form}
                                                            questionNumber={questionNumber}
                                                            questionFieldPath={`${pagesFieldName}[${index}].questions[${questionIndex}]`}
                                                            onRemove={() => removeQuestion(questionIndex)}
                                                        />
                                                    );
                                                }}
                                            </form.Subscribe>
                                        );
                                    })}
                                    {/* if not last page index, add page break */}
                                    {/* you can never remove the first page, the index is always + 1 */}
                                    {index < pages.length - 1 && (
                                        <SortablePageBreakItem
                                            key={pages[index + 1].id}
                                            id={pages[index + 1].id}
                                            onRemove={() => removePageBreak(pages[index + 1].id)}
                                        />
                                    )}
                                </>
                            );
                        }}
                    </form.Field>
                ));
            }}
        </form.Field>
    );
}

function QuestionsList({ form, pagesFieldName }: QuestionsListProps) {
    const mounted = useMounted();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // const itemsString = useQuestionListItems(form, pagesFieldName);
    // const items = typeof itemsString === "string" ? JSON.parse(itemsString) as QuestionOrPageBreak[] : itemsString;
    // console.log(items)
    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    // const items = useMemo(() => _items, [JSON.stringify(_items)]);
    // console.log("items", items);
    const activeId = useStore(store, (state) => state.activeId);

    // // Handler functions at component level

    // const pagesLength = items.filter((i) => i.type === "pageBreak").length;
    // const questionIndex = items.filter((i) => i.type === "question").length;

    return (
        <Stack gap="md">
            {/* for testing only  */}
            <form.AppField name="quizInstructions">
                {(field) => (
                    <field.TextareaField
                        label="Instructions"
                        placeholder="Enter quiz instructions"
                        minRows={3}
                    />
                )}
            </form.AppField>
            <form.AppField name="description">
                {(field) => (
                    <field.TextareaField
                        label="Description"
                        placeholder="Enter quiz description"
                        minRows={3}
                    />
                )}
            </form.AppField>

            {/* pages array mode */}
            <form.Field name={pagesFieldName} mode="array">
                {(pagesField) => {
                    const length = pagesField.state.value?.length ?? 0;

                    function addQuestion() {
                        form
                            .getFieldInfo(`${pagesFieldName}[${length - 1}].questions`)
                            .instance?.pushValue({
                                id: `question-${Date.now()}`,
                                type: "multiple-choice",
                                prompt: "",
                                feedback: "",
                                scoring: {
                                    type: "simple",
                                    points: 1,
                                },
                                options: {
                                    a: "Option A",
                                    b: "Option B",
                                },
                                correctAnswer: "a",
                            });
                    }

                    function addPageBreak() {
                        pagesField.pushValue({
                            id: `page-${Date.now()}`,
                            title: `Page ${length + 1}`,
                            questions: [],
                        });
                    }

                    if (length === 0) {
                        return (
                            <>
                                <Group>
                                    <Button
                                        leftSection={<IconPlus size={16} />}
                                        onClick={() => addQuestion()}
                                    >
                                        Add Question
                                    </Button>
                                    <Button
                                        leftSection={<IconSeparator size={16} />}
                                        variant="light"
                                        onClick={() => addPageBreak()}
                                    >
                                        Add Page Break
                                    </Button>
                                </Group>
                                <Paper withBorder p="xl" radius="md">
                                    <Text ta="center" c="dimmed">
                                        No questions yet. Click "Add Question" to get started.
                                    </Text>
                                </Paper>
                            </>
                        );
                    }

                    const items = pagesToItems(
                        pagesField.state.value ?? [],
                        pagesFieldName,
                    );

                    const handleDragStart = (event: DragStartEvent) => {
                        setActiveId(event.active.id as string);
                    };

                    const handleDragEnd = (event: DragEndEvent) => {
                        const { active, over } = event;

                        if (over && active.id !== over.id) {
                            const oldIndex = items.findIndex((item) =>
                                item.type === "question"
                                    ? item.data.id === active.id
                                    : item.id === active.id,
                            );
                            const newIndex = items.findIndex((item) =>
                                item.type === "question"
                                    ? item.data.id === over.id
                                    : item.id === over.id,
                            );

                            const oldPages = pagesField.state.value ?? [];
                            const newItems = arrayMove(items, oldIndex, newIndex);
                            console.log("newItems", newItems);
                            const simplifiedPages = itemsToPages(newItems);
                            console.log("simplifiedPages", simplifiedPages);
                            const newPages = convertSimplifiedPages(
                                simplifiedPages,
                                oldPages,
                            );
                            console.log("newPages", newPages);
                            form.setFieldValue(pagesFieldName, newPages);
                        }

                        setActiveId(null);
                    };

                    const handleDragCancel = () => {
                        setActiveId(null);
                    };

                    const allQuestions = pagesField.state.value
                        ?.flatMap((page) => page.questions) ?? []

                    // base on the active id, find the page or question
                    const activeItem =
                        pagesField.state.value?.find((page) => page.id === activeId) ??
                        allQuestions
                            .find((question) => question.id === activeId) ??
                        null;

                    // const index = items.findIndex((item) =>
                    //     item.type === "question" ? item.data.id === activeId : item.id === activeId,
                    // );
                    // const activeItem: QuestionOrPageBreak | null =
                    //     index !== -1 ? items[index] : null;

                    const patchedActiveItem:
                        { type: "pageBreak" } | { type: "question", id: string, questionNumber: number, questionTypeLabel: string } | null = activeItem
                            ? "questions" in activeItem
                                ? { type: "pageBreak" }
                                : { type: "question", id: activeItem.id, questionNumber: allQuestions.findIndex((i) => i.id === activeItem.id), questionTypeLabel: getQuestionTypeLabel(activeItem.type) }
                            : null;

                    // const { patchedActiveItem, item } = getItem(items);

                    if (mounted) {
                        return (
                            <>
                                <Group>
                                    <Button
                                        leftSection={<IconPlus size={16} />}
                                        onClick={() => addQuestion()}
                                    >
                                        Add Question
                                    </Button>
                                    <Button
                                        leftSection={<IconSeparator size={16} />}
                                        variant="light"
                                        onClick={() => addPageBreak()}
                                    >
                                        Add Page Break
                                    </Button>
                                </Group>

                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                >
                                    <SortableContext
                                        items={items.map((item) =>
                                            item.type === "question" ? item.data.id : item.id,
                                        )}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <Stack gap="sm">
                                            <ItemListRenderer
                                                form={form}
                                                pagesFieldName={pagesFieldName}
                                            />
                                        </Stack>
                                        {activeItem && (
                                            <DragOverlay adjustScale={false}>
                                                <DragOverlayPreview
                                                    activeItem={patchedActiveItem}
                                                />
                                            </DragOverlay>
                                        )}
                                    </SortableContext>
                                </DndContext>
                            </>
                        );
                    }

                    return (
                        <>
                            <Group>
                                <Button
                                    leftSection={<IconPlus size={16} />}
                                    onClick={() => addQuestion()}
                                >
                                    Add Question
                                </Button>
                                <Button
                                    leftSection={<IconSeparator size={16} />}
                                    variant="light"
                                    // onClick={() => addPageBreak(form, pagesFieldName, pagesLength)}
                                    onClick={() => addPageBreak()}
                                >
                                    Add Page Break
                                </Button>
                            </Group>
                            <Stack gap="sm">
                                <ItemListRenderer form={form} pagesFieldName={pagesFieldName} />
                            </Stack>
                        </>
                    );
                }}
            </form.Field>
        </Stack>
    );
}

// ============================================================================
// REGULAR QUIZ BUILDER (with drag-and-drop list)
// ============================================================================

interface RegularQuizBuilderProps {
    form: UpdateModuleFormApi;
}

export function RegularQuizBuilder({ form }: RegularQuizBuilderProps) {
    const config = form.state.values.rawQuizConfig as QuizConfig;
    if (!config) return null;

    return (
        <Stack gap="lg">
            <form.AppField name="rawQuizConfig.title">
                {(field) => <field.TextInputField label="Quiz Title" required />}
            </form.AppField>

            <form.AppField name="rawQuizConfig.globalTimer">
                {(field) => (
                    <field.NumberInputField
                        label="Global Timer (seconds)"
                        placeholder="Timer for the entire quiz (optional)"
                        min={0}
                    />
                )}
            </form.AppField>

            <GradingConfigEditor form={form} />

            <Box>
                <Title order={4} mb="md">
                    Questions
                </Title>
                <QuestionsList form={form} pagesFieldName="rawQuizConfig.pages" />
            </Box>
        </Stack>
    );
}

// ============================================================================
// NESTED QUIZ TAB (with Tanstack Form arrays)
// ============================================================================

interface NestedQuizTabProps {
    form: UpdateModuleFormApi;
    quizIndex: number;
}

function NestedQuizTab({ form, quizIndex }: NestedQuizTabProps) {
    const basePath = `rawQuizConfig.nestedQuizzes[${quizIndex}]` as const;

    return (
        <Stack gap="md">
            <form.AppField name={`${basePath}.title`}>
                {(field) => <field.TextInputField label="Quiz Title" />}
            </form.AppField>

            <form.AppField name={`${basePath}.description`}>
                {(field) => (
                    <field.TextareaField label="Description (optional)" minRows={2} />
                )}
            </form.AppField>

            <form.AppField name={`${basePath}.globalTimer`}>
                {(field) => (
                    <field.NumberInputField
                        label="Time Limit (seconds)"
                        placeholder="Timer for this quiz (optional)"
                        min={0}
                    />
                )}
            </form.AppField>

            <NestedGradingConfigEditor form={form} quizIndex={quizIndex} />

            <Box>
                <Title order={5} mb="md">
                    Questions
                </Title>
                <QuestionsList form={form} pagesFieldName={`${basePath}.pages`} />
            </Box>
        </Stack>
    );
}

// ============================================================================
// NESTED QUIZZES MANAGER
// ============================================================================

interface NestedQuizzesManagerProps {
    form: UpdateModuleFormApi;
}

function NestedQuizzesManager({ form }: NestedQuizzesManagerProps) {
    // when value is null, by default it shows the first tab
    const [activeTab, setActiveTab] = useState<string | null>(null);

    return (
        <form.AppField name="rawQuizConfig.nestedQuizzes" mode="array">
            {(nestedQuizzesField) => {
                const quizzes = nestedQuizzesField.state.value || [];

                return (
                    <>
                        <Group justify="space-between" mb="md">
                            <Title order={4}>Nested Quizzes</Title>
                            <Button
                                leftSection={<IconPlus size={16} />}
                                onClick={() => {
                                    const newQuiz: NestedQuizConfig = {
                                        id: `nested-${Date.now()}`,
                                        title: `Quiz ${quizzes.length + 1}`,
                                        pages: [],
                                        grading: {
                                            enabled: false,
                                            passingScore: 70,
                                            showScoreToStudent: true,
                                            showCorrectAnswers: false,
                                        },
                                    };
                                    nestedQuizzesField.pushValue(newQuiz);
                                    setActiveTab(newQuiz.id);
                                }}
                            >
                                Add Quiz
                            </Button>
                        </Group>

                        {quizzes.length === 0 ? (
                            <Paper withBorder p="xl" radius="md">
                                <Text ta="center" c="dimmed">
                                    No quizzes yet. Click "Add Quiz" to create your first quiz.
                                </Text>
                            </Paper>
                        ) : (
                            <Tabs value={activeTab} onChange={setActiveTab}>
                                <Tabs.List>
                                    {quizzes.map((quiz, index) => (
                                        <Tabs.Tab key={quiz.id} value={quiz.id}>
                                            {quiz.title || `Quiz ${index + 1}`}
                                        </Tabs.Tab>
                                    ))}
                                </Tabs.List>

                                {quizzes.map((quiz, index) => (
                                    <Tabs.Panel key={quiz.id} value={quiz.id} pt="md">
                                        <Stack gap="md">
                                            {/* Header with quiz title and remove button */}
                                            <Group justify="space-between">
                                                <Title order={5}>
                                                    {quiz.title || `Quiz ${index + 1}`}
                                                </Title>
                                                <ActionIcon
                                                    color="red"
                                                    variant="subtle"
                                                    onClick={() => {
                                                        nestedQuizzesField.removeValue(index);
                                                        // Update active tab if removing current one
                                                        if (activeTab === quiz.id && quizzes.length > 1) {
                                                            const newQuizzes = quizzes.filter(
                                                                (_, i) => i !== index,
                                                            );
                                                            setActiveTab(newQuizzes[0]?.id || null);
                                                        }
                                                    }}
                                                    title="Remove this quiz"
                                                >
                                                    <IconTrash size={16} />
                                                </ActionIcon>
                                            </Group>

                                            <NestedQuizTab form={form} quizIndex={index} />
                                        </Stack>
                                    </Tabs.Panel>
                                ))}
                            </Tabs>
                        )}
                    </>
                );
            }}
        </form.AppField>
    );
}

// ============================================================================
// CONTAINER QUIZ BUILDER (with Tanstack Form arrays)
// ============================================================================

interface ContainerQuizBuilderProps {
    form: UpdateModuleFormApi;
}

export function ContainerQuizBuilder({ form }: ContainerQuizBuilderProps) {
    const config = form.state.values.rawQuizConfig as QuizConfig;

    if (!config) return null;

    return (
        <Stack gap="lg">
            <form.AppField name="rawQuizConfig.title">
                {(field) => (
                    <field.TextInputField label="Container Quiz Title" required />
                )}
            </form.AppField>

            <form.AppField name="rawQuizConfig.sequentialOrder">
                {(field) => (
                    <field.CheckboxField label="Sequential Order (Quizzes must be completed in order)" />
                )}
            </form.AppField>

            <form.AppField name="rawQuizConfig.globalTimer">
                {(field) => (
                    <field.NumberInputField
                        label="Global Timer (seconds)"
                        placeholder="Parent-level timer for all quizzes (optional)"
                        min={0}
                    />
                )}
            </form.AppField>

            <GradingConfigEditor form={form} />

            <Box>
                <NestedQuizzesManager form={form} />
            </Box>
        </Stack>
    );
}
