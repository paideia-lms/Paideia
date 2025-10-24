import {
    ActionIcon,
    Box,
    Button,
    Card,
    Checkbox,
    Group,
    NumberInput,
    Paper,
    Select,
    Stack,
    Tabs,
    Text,
    Textarea,
    TextInput,
    Title,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import {
    IconChevronDown,
    IconChevronUp,
    IconGripVertical,
    IconPlus,
    IconSeparator,
    IconTrash,
} from "@tabler/icons-react";
import type {
    GradingConfig,
    MultipleChoiceQuestion,
    NestedQuizConfig,
    Question,
    QuizConfig,
    ScoringConfig,
} from "~/components/activity-modules-preview/quiz-config.types";
import { useMounted } from "@mantine/hooks";
import type { UseFormReturnType, } from "@mantine/form";
import type { ActivityModuleFormValues } from "../activity-module-form";
import { useFormWatchValue } from "~/hooks/form-utils";




// ============================================================================
// TYPES FOR PAGE BREAK
// ============================================================================

type QuestionOrPageBreak =
    | { type: "question"; data: Question }
    | { type: "pageBreak"; id: string };

// ============================================================================
// GRADING CONFIG EDITOR
// ============================================================================

function PassScoringInput({ form }: { form: UseFormReturnType<ActivityModuleFormValues> }) {
    return (
        <NumberInput
            {...form.getInputProps("rawQuizConfig.grading.passingScore")}
            key={form.key("rawQuizConfig.grading.passingScore")}
            label="Passing Score (%)"
            description="Minimum percentage to pass (0-100)"
            min={0}
            max={100}
        />
    );
}

interface GradingConfigEditorProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    grading: GradingConfig;
}

export function GradingConfigEditor({
    form,
    grading,
}: GradingConfigEditorProps) {
    if (form === undefined) return null;
    const currentConfig = grading;

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
                <Title order={5}>Grading Configuration</Title>

                <Checkbox
                    {...form.getInputProps("rawQuizConfig.grading.enabled", {
                        type: "checkbox",
                    })}
                    key={form.key("rawQuizConfig.grading.enabled")}
                    label="Enable Grading"
                />

                {currentConfig.enabled && (
                    <>
                        <PassScoringInput form={form} />

                        <Checkbox
                            {...form.getInputProps(
                                "rawQuizConfig.grading.showScoreToStudent",
                                { type: "checkbox" },
                            )}
                            key={form.key("rawQuizConfig.grading.showScoreToStudent")}
                            label="Show Score to Student Immediately"
                        />

                        <Checkbox
                            {...form.getInputProps(
                                "rawQuizConfig.grading.showCorrectAnswers",
                                { type: "checkbox" },
                            )}
                            key={form.key("rawQuizConfig.grading.showCorrectAnswers")}
                            label="Show Correct Answers After Submission"
                        />
                    </>
                )}
            </Stack>
        </Paper>
    );
}

// ============================================================================
// SCORING EDITOR
// ============================================================================

function ScoringEditor({
    questionType,
    scoring,
    onChange,
}: {
    questionType: Question["type"];
    scoring: ScoringConfig | undefined;
    onChange: (scoring: ScoringConfig) => void;
}) {
    const defaultScoring: ScoringConfig =
        questionType === "long-answer"
            ? { type: "manual", maxPoints: 1 }
            : { type: "simple", points: 1 };

    const currentScoring = scoring || defaultScoring;

    if (currentScoring.type === "simple") {
        return (
            <NumberInput
                label="Points"
                description="Points awarded for correct answer"
                value={currentScoring.points}
                onChange={(val) =>
                    onChange({
                        type: "simple",
                        points: typeof val === "number" ? val : 1,
                    })
                }
                min={0}
                size="sm"
            />
        );
    }

    if (currentScoring.type === "manual") {
        return (
            <NumberInput
                label="Maximum Points"
                description="Maximum points for manual grading"
                value={currentScoring.maxPoints}
                onChange={(val) =>
                    onChange({
                        type: "manual",
                        maxPoints: typeof val === "number" ? val : 1,
                    })
                }
                min={0}
                size="sm"
            />
        );
    }

    return null;
}

// ============================================================================
// MULTIPLE CHOICE EDITOR
// ============================================================================

function MultipleChoiceEditor({
    question,
    onChange,
}: {
    question: MultipleChoiceQuestion;
    onChange: (updated: Question) => void;
}) {
    const options = question.options || {};
    const optionKeys = Object.keys(options);

    const addOption = () => {
        const nextKey = String.fromCharCode(97 + optionKeys.length);
        onChange({
            ...question,
            options: { ...options, [nextKey]: "" },
        });
    };

    const removeOption = (key: string) => {
        const newOptions = { ...options };
        delete newOptions[key];
        onChange({
            ...question,
            options: newOptions,
            correctAnswer:
                question.correctAnswer === key ? undefined : question.correctAnswer,
        });
    };

    const updateOption = (key: string, value: string) => {
        onChange({
            ...question,
            options: { ...options, [key]: value },
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

            {optionKeys.map((key) => (
                <Group key={key} gap="xs" wrap="nowrap">
                    <TextInput
                        placeholder={`Option ${key.toUpperCase()}`}
                        value={options[key]}
                        onChange={(e) => updateOption(key, e.currentTarget.value)}
                        style={{ flex: 1 }}
                        size="sm"
                    />
                    <Checkbox
                        label="Correct"
                        checked={question.correctAnswer === key}
                        onChange={(e) =>
                            onChange({
                                ...question,
                                correctAnswer: e.currentTarget.checked ? key : undefined,
                            })
                        }
                    />
                    <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => removeOption(key)}
                        disabled={optionKeys.length <= 2}
                    >
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            ))}
        </Stack>
    );
}

// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================

interface SortableQuestionItemProps {
    item: QuestionOrPageBreak;
    questionNumber: number;
    onUpdate: (updated: Question) => void;
    onRemove: () => void;
}

function SortableQuestionItem({
    item,
    questionNumber,
    onUpdate,
    onRemove,
}: SortableQuestionItemProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.type === "question" ? item.data.id : item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    if (item.type === "pageBreak") {
        return (
            <Box ref={setNodeRef} style={style}>
                <Paper withBorder p="sm" radius="md" bg="gray.0">
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

    const question = item.data;

    const renderQuestionTypeFields = () => {
        switch (question.type) {
            case "multiple-choice":
                return (
                    <MultipleChoiceEditor
                        question={question as MultipleChoiceQuestion}
                        onChange={onUpdate}
                    />
                );

            case "short-answer":
                return (
                    <TextInput
                        label="Correct Answer (optional)"
                        description="For automatic grading (exact match)"
                        value={question.correctAnswer || ""}
                        onChange={(e) =>
                            onUpdate({
                                ...question,
                                correctAnswer: e.currentTarget.value,
                            })
                        }
                        size="sm"
                    />
                );

            case "long-answer":
                return (
                    <Textarea
                        label="Sample/Expected Answer (optional)"
                        description="For reference purposes (requires manual grading)"
                        value={question.correctAnswer || ""}
                        onChange={(e) =>
                            onUpdate({
                                ...question,
                                correctAnswer: e.currentTarget.value,
                            })
                        }
                        minRows={3}
                        size="sm"
                    />
                );

            default:
                return <Text c="dimmed">Question type not yet implemented</Text>;
        }
    };

    const questionTypeLabel =
        question.type === "multiple-choice"
            ? "Multiple Choice"
            : question.type === "short-answer"
                ? "Short Answer"
                : "Long Answer";

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
                            <Text fw={500} size="sm">
                                Question {questionNumber}: {questionTypeLabel}
                            </Text>
                            {!isExpanded && question.prompt && (
                                <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                                    {question.prompt}
                                </Text>
                            )}
                        </Group>
                        <Group gap="xs">
                            <ActionIcon
                                variant="subtle"
                                onClick={() => setIsExpanded(!isExpanded)}
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
                            <Select
                                label="Question Type"
                                value={question.type}
                                onChange={(val) => {
                                    const baseQuestion = {
                                        id: question.id,
                                        prompt: question.prompt,
                                        feedback: question.feedback,
                                        type: val as Question["type"],
                                    };

                                    if (val === "multiple-choice") {
                                        onUpdate({
                                            ...baseQuestion,
                                            type: "multiple-choice",
                                            options: { a: "Option A", b: "Option B" },
                                            correctAnswer: "a",
                                            scoring: { type: "simple", points: 1 },
                                        });
                                    } else if (val === "short-answer") {
                                        onUpdate({
                                            ...baseQuestion,
                                            type: "short-answer",
                                            correctAnswer: "",
                                            scoring: { type: "simple", points: 1 },
                                        });
                                    } else if (val === "long-answer") {
                                        onUpdate({
                                            ...baseQuestion,
                                            type: "long-answer",
                                            correctAnswer: "",
                                            scoring: { type: "manual", maxPoints: 1 },
                                        });
                                    }
                                }}
                                data={[
                                    { value: "multiple-choice", label: "Multiple Choice" },
                                    { value: "short-answer", label: "Short Answer" },
                                    { value: "long-answer", label: "Long Answer" },
                                ]}
                                size="sm"
                            />

                            <Textarea
                                label="Question Prompt"
                                value={question.prompt}
                                onChange={(e) =>
                                    onUpdate({ ...question, prompt: e.currentTarget.value })
                                }
                                minRows={2}
                                required
                                size="sm"
                            />

                            {renderQuestionTypeFields()}

                            <Textarea
                                label="Feedback (optional)"
                                description="Shown to students after answering"
                                value={question.feedback || ""}
                                onChange={(e) =>
                                    onUpdate({ ...question, feedback: e.currentTarget.value })
                                }
                                minRows={2}
                                size="sm"
                            />

                            <ScoringEditor
                                questionType={question.type}
                                scoring={question.scoring}
                                onChange={(scoring) => onUpdate({ ...question, scoring })}
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
    items: QuestionOrPageBreak[];
    onChange: (items: QuestionOrPageBreak[]) => void;
}

function QuestionsList({ items, onChange }: QuestionsListProps) {
    const mounted = useMounted();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
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

            onChange(arrayMove(items, oldIndex, newIndex));
        }

        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const activeItem = activeId
        ? items.find((item) =>
            item.type === "question"
                ? item.data.id === activeId
                : item.id === activeId,
        )
        : null;

    const addQuestion = () => {
        const newQuestion: QuestionOrPageBreak = {
            type: "question",
            data: {
                id: `question-${Date.now()}`,
                type: "multiple-choice",
                prompt: "",
                options: { a: "Option A", b: "Option B" },
                correctAnswer: "a",
                scoring: { type: "simple", points: 1 },
            },
        };
        onChange([...items, newQuestion]);
    };

    const addPageBreak = () => {
        const newPageBreak: QuestionOrPageBreak = {
            type: "pageBreak",
            id: `pageBreak-${Date.now()}`,
        };
        onChange([...items, newPageBreak]);
    };

    const updateQuestion = (index: number, updated: Question) => {
        const newItems = [...items];
        if (newItems[index].type === "question") {
            newItems[index] = { type: "question", data: updated };
            onChange(newItems);
        }
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <Stack gap="md">
            <Group>
                <Button leftSection={<IconPlus size={16} />} onClick={addQuestion}>
                    Add Question
                </Button>
                <Button
                    leftSection={<IconSeparator size={16} />}
                    variant="light"
                    onClick={addPageBreak}
                >
                    Add Page Break
                </Button>
            </Group>

            {items.length === 0 ? (
                <Paper withBorder p="xl" radius="md">
                    <Text ta="center" c="dimmed">
                        No questions yet. Click "Add Question" to get started.
                    </Text>
                </Paper>
            ) : !mounted ? (
                // Server-side render: static list without drag-and-drop
                <Stack gap="sm">
                    {items.map((item, index) => {
                        const questionNumber = items
                            .slice(0, index + 1)
                            .filter((i) => i.type === "question").length;

                        return (
                            <div key={item.type === "question" ? item.data.id : item.id}>
                                <SortableQuestionItem
                                    item={item}
                                    questionNumber={questionNumber}
                                    onUpdate={(updated) => updateQuestion(index, updated)}
                                    onRemove={() => removeItem(index)}
                                />
                            </div>
                        );
                    })}
                </Stack>
            ) : (
                // Client-side render: drag-and-drop enabled
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
                            {items.map((item, index) => {
                                // Calculate question number (counting only questions before this item)
                                const questionNumber = items
                                    .slice(0, index + 1)
                                    .filter((i) => i.type === "question").length;

                                return (
                                    <SortableQuestionItem
                                        key={item.type === "question" ? item.data.id : item.id}
                                        item={item}
                                        questionNumber={questionNumber}
                                        onUpdate={(updated) => updateQuestion(index, updated)}
                                        onRemove={() => removeItem(index)}
                                    />
                                );
                            })}
                        </Stack>
                    </SortableContext>
                    <DragOverlay>
                        {activeItem ? (
                            activeItem.type === "pageBreak" ? (
                                <Paper
                                    withBorder
                                    p="sm"
                                    radius="md"
                                    bg="gray.0"
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
                            ) : (
                                <Card
                                    withBorder
                                    radius="md"
                                    p="md"
                                    style={{ cursor: "grabbing" }}
                                >
                                    <Group justify="space-between" wrap="nowrap">
                                        <Group gap="xs" style={{ flex: 1 }}>
                                            <IconGripVertical size={16} />
                                            <Text fw={500} size="sm">
                                                Question{" "}
                                                {
                                                    items
                                                        .slice(
                                                            0,
                                                            items.findIndex(
                                                                (i) =>
                                                                    i.type === "question" &&
                                                                    i.data.id === activeItem.data.id,
                                                            ) + 1,
                                                        )
                                                        .filter((i) => i.type === "question").length
                                                }
                                                :{" "}
                                                {activeItem.data.type === "multiple-choice"
                                                    ? "Multiple Choice"
                                                    : activeItem.data.type === "short-answer"
                                                        ? "Short Answer"
                                                        : "Long Answer"}
                                            </Text>
                                            {activeItem.data.prompt && (
                                                <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                                                    {activeItem.data.prompt}
                                                </Text>
                                            )}
                                        </Group>
                                    </Group>
                                </Card>
                            )
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
        </Stack>
    );
}

// ============================================================================
// REGULAR QUIZ BUILDER (with drag-and-drop list)
// ============================================================================

interface RegularQuizBuilderProps {
    form: any; // UseFormReturnType<ActivityModuleFormValues>
}

export function RegularQuizBuilder({ form }: RegularQuizBuilderProps) {
    // Get config from form - only for reading structure
    const config = form.getValues().rawQuizConfig as QuizConfig;
    if (!config) return null;

    // Convert pages structure to flat list with page breaks
    const itemsToList = (): QuestionOrPageBreak[] => {
        const result: QuestionOrPageBreak[] = [];
        const pages = config.pages || [];

        pages.forEach((page, pageIndex) => {
            page.questions.forEach((question) => {
                result.push({ type: "question", data: question });
            });

            // Add page break between pages (but not after the last page)
            if (pageIndex < pages.length - 1) {
                result.push({ type: "pageBreak", id: `pageBreak-${pageIndex}` });
            }
        });

        return result;
    };

    // Convert flat list back to pages structure
    // Page breaks split items into pages, even if pages are empty
    const listToPages = (items: QuestionOrPageBreak[]) => {
        if (items.length === 0) {
            return [];
        }

        const pages: QuizConfig["pages"] = [];
        let currentPage: Question[] = [];

        items.forEach((item) => {
            if (item.type === "question") {
                currentPage.push(item.data);
            } else if (item.type === "pageBreak") {
                // Always create a page at page break boundary (even if empty)
                pages.push({
                    id: `page-${Date.now()}-${pages.length}`,
                    title: `Page ${pages.length + 1}`,
                    questions: currentPage,
                });
                currentPage = [];
            }
        });

        // Always add the last page (even if empty)
        pages.push({
            id: `page-${Date.now()}-${pages.length}`,
            title: `Page ${pages.length + 1}`,
            questions: currentPage,
        });

        return pages;
    };

    const handleItemsChange = (items: QuestionOrPageBreak[]) => {
        const pages = listToPages(items);
        form.setFieldValue("rawQuizConfig.pages", pages);
    };

    return (
        <Stack gap="lg">
            <TextInput
                label="Quiz Title"
                {...form.getInputProps("rawQuizConfig.title")}
                key={form.key("rawQuizConfig.title")}
                required
            />

            <NumberInput
                label="Global Timer (seconds)"
                description="Timer for the entire quiz (optional)"
                {...form.getInputProps("rawQuizConfig.globalTimer")}
                key={form.key("rawQuizConfig.globalTimer")}
                min={0}
            />
            {config.grading && (
                <GradingConfigEditor form={form} grading={config.grading} />
            )}

            <Box>
                <Title order={4} mb="md">
                    Questions
                </Title>
                <QuestionsList items={itemsToList()} onChange={handleItemsChange} />
            </Box>
        </Stack>
    );
}

// ============================================================================
// NESTED QUIZ TAB (with drag-and-drop list)
// ============================================================================


interface NestedQuizTabProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    quizIndex: number;
}

function NestedQuizTab({ form, quizIndex }: NestedQuizTabProps) {
    if (!form) return null;
    const nestedQuiz = form.getValues().rawQuizConfig?.nestedQuizzes?.[quizIndex];
    if (!nestedQuiz) return null;
    // Convert pages structure to flat list with page breaks
    const itemsToList = (): QuestionOrPageBreak[] => {
        const result: QuestionOrPageBreak[] = [];
        const pages = nestedQuiz.pages || [];

        pages.forEach((page, pageIndex) => {
            page.questions.forEach((question) => {
                result.push({ type: "question", data: question });
            });

            if (pageIndex < pages.length - 1) {
                result.push({ type: "pageBreak", id: `pageBreak-${pageIndex}` });
            }
        });

        return result;
    };

    const items = itemsToList();

    // Convert flat list back to pages structure
    // Page breaks split items into pages, even if pages are empty
    const listToPages = (items: QuestionOrPageBreak[]) => {
        if (items.length === 0) {
            return [];
        }

        const pages: NestedQuizConfig["pages"] = [];
        let currentPage: Question[] = [];

        items.forEach((item) => {
            if (item.type === "question") {
                currentPage.push(item.data);
            } else if (item.type === "pageBreak") {
                // Always create a page at page break boundary (even if empty)
                pages.push({
                    id: `page-${Date.now()}-${pages.length}`,
                    title: `Page ${pages.length + 1}`,
                    questions: currentPage,
                });
                currentPage = [];
            }
        });

        // Always add the last page (even if empty)
        pages.push({
            id: `page-${Date.now()}-${pages.length}`,
            title: `Page ${pages.length + 1}`,
            questions: currentPage,
        });

        return pages;
    };

    // const handleItemsChange = (items: QuestionOrPageBreak[]) => {
    //     const pages = listToPages(items);
    //     onChange({ ...nestedQuiz, pages });
    // };

    return (
        <Stack gap="md">
            <TextInput
                {...form.getInputProps(
                    `rawQuizConfig.nestedQuizzes.${quizIndex}.title`,
                )}
                key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.title`)}
                label="Quiz Title"
            />

            <Textarea
                {...form.getInputProps(
                    `rawQuizConfig.nestedQuizzes.${quizIndex}.description`,
                )}
                key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.description`)}
                label="Description (optional)"
                minRows={2}
            />

            <NumberInput
                {...form.getInputProps(
                    `rawQuizConfig.nestedQuizzes.${quizIndex}.globalTimer`,
                )}
                key={form.key(`rawQuizConfig.nestedQuizzes.${quizIndex}.globalTimer`)}
                label="Time Limit (seconds)"
                description="Timer for this quiz (optional)"
                min={0}
            />

            {nestedQuiz.grading && (
                <GradingConfigEditor form={form} grading={nestedQuiz.grading} />
            )}

            <Box>
                <Title order={5} mb="md">
                    Questions
                </Title>
                {/* <QuestionsList items={items} onChange={handleItemsChange} /> */}
            </Box>
        </Stack>
    );
}


// ============================================================================
// CONTAINER QUIZ BUILDER (with Tabs)
// ============================================================================



interface ContainerQuizBuilderProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
}

export function ContainerQuizBuilder({ form }: ContainerQuizBuilderProps) {
    // Get config from form - only for reading structure
    const config = form.getValues().rawQuizConfig as QuizConfig;
    const nestedQuizzes = config?.nestedQuizzes || [];
    const [activeTab, setActiveTab] = useState<string | null>(
        nestedQuizzes[0]?.id || null,
    );

    if (!config) return null;

    const addNestedQuiz = () => {
        const newQuiz: NestedQuizConfig = {
            id: `nested-${Date.now()}`,
            title: `Quiz ${nestedQuizzes.length + 1}`,
            pages: [],
        };
        form.insertListItem("rawQuizConfig.nestedQuizzes", newQuiz);
        setActiveTab(newQuiz.id);
    };

    const removeNestedQuiz = (index: number) => {
        form.removeListItem("rawQuizConfig.nestedQuizzes", index);
        if (activeTab === nestedQuizzes[index].id && nestedQuizzes.length > 1) {
            setActiveTab(
                nestedQuizzes[0].id === nestedQuizzes[index].id
                    ? nestedQuizzes[1].id
                    : nestedQuizzes[0].id,
            );
        }
    };

    return (
        <Stack gap="lg">
            <TextInput
                {...form.getInputProps("rawQuizConfig.title")}
                key={form.key("rawQuizConfig.title")}
                label="Container Quiz Title"
                required
            />

            <Checkbox
                {...form.getInputProps("rawQuizConfig.sequentialOrder", {
                    type: "checkbox",
                })}
                key={form.key("rawQuizConfig.sequentialOrder")}
                label="Sequential Order"
                description="Quizzes must be completed in order"
            />

            <NumberInput
                {...form.getInputProps("rawQuizConfig.globalTimer")}
                key={form.key("rawQuizConfig.globalTimer")}
                min={0}
                label="Global Timer (seconds)"
                description="Parent-level timer for all quizzes (optional)"
            />

            {config.grading && (
                <GradingConfigEditor form={form} grading={config.grading} />
            )}

            <Box>
                <Group justify="space-between" mb="md">
                    <Title order={4}>Nested Quizzes</Title>
                    <Button leftSection={<IconPlus size={16} />} onClick={addNestedQuiz}>
                        Add Quiz
                    </Button>
                </Group>

                {nestedQuizzes.length === 0 ? (
                    <Paper withBorder p="xl" radius="md">
                        <Text ta="center" c="dimmed">
                            No quizzes yet. Click "Add Quiz" to create your first quiz.
                        </Text>
                    </Paper>
                ) : (
                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            {nestedQuizzes.map((quiz, index) => (
                                <Tabs.Tab key={quiz.id} value={quiz.id}>
                                    {quiz.title || `Quiz ${index + 1}`}
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>

                        {nestedQuizzes.map((quiz, index) => (
                            <Tabs.Panel key={quiz.id} value={quiz.id} pt="md">
                                <Stack gap="md">
                                    {/* Header with quiz title and remove button */}
                                    <Group justify="space-between">
                                        <Title order={5}>{quiz.title || `Quiz ${index + 1}`}</Title>
                                        <ActionIcon
                                            color="red"
                                            variant="subtle"
                                            onClick={() => removeNestedQuiz(index)}
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
            </Box>
        </Stack>
    );
}
