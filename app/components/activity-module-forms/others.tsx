import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    Text,
    Textarea,
    TextInput,
    Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useMounted } from "@mantine/hooks";
import {
    IconChevronDown,
    IconChevronUp,
    IconGripVertical,
    IconPlus,
    IconSeparator,
    IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import type {
    MultipleChoiceQuestion,
    Question,
    QuizPage,
    ScoringConfig,
} from "server/json/raw-quiz-config.types.v2";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { getPath, useFormWatchForceUpdate } from "~/utils/form-utils";



// ============================================================================
// GRADING CONFIG EDITOR
// ============================================================================

export function PassScoringInput({
    form,
}: {
    form: UseFormReturnType<ActivityModuleFormValues>;
}) {
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

export interface GradingConfigEditorProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    path:
    | "rawQuizConfig.grading"
    | `rawQuizConfig.nestedQuizzes.${number}.grading`
}

export function GradingConfigEditor({ form, path }: GradingConfigEditorProps) {
    const _grading = useFormWatchForceUpdate(form, path, ({ previousValue, value }) => {
        return previousValue?.enabled !== value?.enabled;
    })
    const grading = _grading ?? {
        enabled: false
    }


    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
                <Title order={5}>Grading Configuration</Title>
                <Checkbox
                    {...form.getInputProps(`${path}.enabled`, {
                        type: "checkbox",
                    })}
                    onChange={(e) => {
                        if (_grading === undefined)
                            form.setFieldValue(path, { enabled: e.currentTarget.checked });
                        else
                            form.setFieldValue(`${path}.enabled`, e.currentTarget.checked);
                    }}
                    key={form.key(`${path}.enabled`)}
                    label="Enable Grading"
                />

                {grading.enabled && (
                    <>
                        <PassScoringInput form={form} />

                        <Checkbox
                            {...form.getInputProps(`${path}.showScoreToStudent`, {
                                type: "checkbox",
                            })}
                            key={form.key(`${path}.showScoreToStudent`)}
                            label="Show Score to Student Immediately"
                        />

                        <Checkbox
                            {...form.getInputProps(`${path}.showCorrectAnswers`, {
                                type: "checkbox",
                            })}
                            key={form.key(`${path}.showCorrectAnswers`)}
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

export interface ScoringEditorProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    path:
    | `rawQuizConfig.pages.${number}.questions.${number}`
    | `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function ScoringEditor({ form, path }: ScoringEditorProps) {
    const questionType = useFormWatchForceUpdate(form, `${path}.type` as const);
    const scoring = useFormWatchForceUpdate(form, `${path}.scoring` as const);

    const defaultScoring: ScoringConfig =
        questionType === "long-answer"
            ? { type: "manual", maxPoints: 1 }
            : { type: "simple", points: 1 };

    const currentScoring = scoring || defaultScoring;
    const scoringPath = `${path}.scoring` as const;

    if (currentScoring.type === "simple") {
        return (
            <NumberInput
                {...form.getInputProps(`${scoringPath}.points`)}
                key={form.key(`${scoringPath}.points`)}
                label="Points"
                description="Points awarded for correct answer"
                min={0}
                size="sm"
            />
        );
    }

    if (currentScoring.type === "manual") {
        return (
            <NumberInput
                {...form.getInputProps(`${scoringPath}.maxPoints`)}
                key={form.key(`${scoringPath}.maxPoints`)}
                label="Maximum Points"
                description="Maximum points for manual grading"
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

export interface MultipleChoiceEditorProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    path:
    | `rawQuizConfig.pages.${number}.questions.${number}`
    | `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
}

export function MultipleChoiceEditor({ form, path }: MultipleChoiceEditorProps) {
    // Watch options and correctAnswer
    const questionData = getPath(path, form.getValues()) as MultipleChoiceQuestion;
    useFormWatchForceUpdate(form, `${path}.options` as const)
    useFormWatchForceUpdate(form, `${path}.correctAnswer` as const)

    const options = questionData.options;
    const optionKeys = Object.keys(options);

    const addOption = () => {
        const nextKey = String.fromCharCode(97 + optionKeys.length);
        form.setFieldValue(`${path}.options.${nextKey}` as const, "");
    };

    const removeOption = (key: string) => {
        const currentQuestion = getPath(path, form.getValues()) as MultipleChoiceQuestion;
        const newOptions = { ...currentQuestion.options };
        delete newOptions[key];

        form.setFieldValue(`${path}.options` as const, newOptions);

        // Clear correctAnswer if it was the removed option
        if (currentQuestion.correctAnswer === key) {
            form.setFieldValue(`${path}.correctAnswer` as const, undefined);
        }
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
                        {...form.getInputProps(`${path}.options.${key}`)}
                        key={form.key(`${path}.options.${key}`)}
                        placeholder={`Option ${key.toUpperCase()}`}
                        style={{ flex: 1 }}
                        size="sm"
                    />
                    <Checkbox
                        // {...form.getInputProps(`${path}.correctAnswer`, { type: "checkbox" })}
                        // key={form.key(`${path}.correctAnswer`)}
                        label="Correct"
                        checked={questionData.correctAnswer === key}
                        onChange={(e) => {
                            // if same correct answer, don't change it
                            if (questionData.correctAnswer === key) {
                                return;
                            }
                            form.setFieldValue(
                                `${path}.correctAnswer` as const,
                                e.currentTarget.checked ? key : undefined,
                                { forceUpdate: false }
                            );
                        }}
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
// SORTABLE PAGE BREAK ITEM
// ============================================================================

export interface SortablePageBreakItemProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    basePath: "rawQuizConfig.pages" | `rawQuizConfig.nestedQuizzes.${number}.pages`;
    id: string; // Format: "pageBreak-{pageId}"
    pageNumber: number;
}

export function SortablePageBreakItem({
    form,
    basePath,
    id,
    pageNumber,
}: SortablePageBreakItemProps) {
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

    const handleRemove = () => {
        const currentPages = (getPath(basePath, form.getValues())) || [];
        if (currentPages.length <= 1) return; // Don't remove the last page

        // Extract page ID from id prop
        const pageId = id.replace("pageBreak-", "");
        const pageIndex = currentPages.findIndex((p) => p.id === pageId);

        if (pageIndex === -1 || pageIndex === 0) return; // Don't remove page 0

        // we get the question in this page and move them to previous page 
        const questions = currentPages[pageIndex].questions;
        const previousPage = currentPages[pageIndex - 1];
        const updatedQuestions = [...previousPage.questions, ...questions];
        previousPage.questions = updatedQuestions;
        const updatedPages = currentPages.filter((_, index) => index !== pageIndex);
        form.setFieldValue(basePath, updatedPages);
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
                            Page Break {pageNumber}
                        </Text>
                    </Group>
                    <ActionIcon color="red" variant="subtle" onClick={handleRemove}>
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            </Paper>
        </Box>
    );
}

// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================

export interface SortableQuestionItemProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    path: `rawQuizConfig.pages.${number}.questions.${number}` | `rawQuizConfig.nestedQuizzes.${number}.pages.${number}.questions.${number}`;
    questionNumber: number;
    pageNumber: number;
}

export function SortableQuestionItem({
    form,
    path,
    questionNumber,
    pageNumber,
}: SortableQuestionItemProps) {
    const parts = path.split('.')
    const pageIndex = Number.parseInt(parts[parts.indexOf("pages") + 1]);
    const questionIndex = Number.parseInt(parts[parts.indexOf("questions") + 1]);
    const pagesPath = parts.slice(0, parts.indexOf("pages") + 1).join(".") as `rawQuizConfig.pages` | `rawQuizConfig.nestedQuizzes.${number}.pages`;
    const [isExpanded, setIsExpanded] = useState(false);

    // Get the question from form state
    const questionId = useFormWatchForceUpdate(form, `${path}.id` as const);
    const questionPrompt = useFormWatchForceUpdate(form, `${path}.prompt` as const);
    const questionType = useFormWatchForceUpdate(form, `${path}.type` as const);

    const question = {
        id: questionId,
        prompt: questionPrompt,
        type: questionType,
    }

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: questionId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };


    const updateQuestion = (updated: Question) => {
        form.setFieldValue(path, updated);
    };

    const handleRemove = () => {
        // Parse path to extract pageIndex and questionIndex
        // Path format: "rawQuizConfig.pages.{pageIndex}.questions.{questionIndex}"
        // or "rawQuizConfig.nestedQuizzes.{nestedIndex}.pages.{pageIndex}.questions.{questionIndex}"


        const currentPages = getPath(pagesPath, form.getValues());
        const updatedPages = [...currentPages];
        const updatedQuestions = [...updatedPages[pageIndex].questions];
        updatedQuestions.splice(questionIndex, 1);

        updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            questions: updatedQuestions,
        };

        form.setFieldValue(pagesPath, updatedPages);
    };

    const renderQuestionTypeFields = () => {
        switch (question.type) {
            case "multiple-choice":
                return <MultipleChoiceEditor form={form} path={path} />;

            case "short-answer":
                return (
                    <TextInput
                        {...form.getInputProps(`${path}.correctAnswer`)}
                        key={form.key(`${path}.correctAnswer`)}
                        label="Correct Answer (optional)"
                        description="For automatic grading (exact match)"
                        size="sm"
                    />
                );

            case "long-answer":
                return (
                    <Textarea
                        {...form.getInputProps(`${path}.correctAnswer`)}
                        key={form.key(`${path}.correctAnswer`)}
                        label="Sample/Expected Answer (optional)"
                        description="For reference purposes (requires manual grading)"
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
                                Question {questionNumber} (Page {pageNumber}): {questionTypeLabel}
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
                            <ActionIcon color="red" variant="subtle" onClick={handleRemove}>
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
                                        type: val as Question["type"],
                                    };

                                    if (val === "multiple-choice") {
                                        updateQuestion({
                                            ...baseQuestion,
                                            type: "multiple-choice",
                                            options: { a: "Option A", b: "Option B" },
                                            correctAnswer: "a",
                                            scoring: { type: "simple", points: 1 },
                                        });
                                    } else if (val === "short-answer") {
                                        updateQuestion({
                                            ...baseQuestion,
                                            type: "short-answer",
                                            correctAnswer: "",
                                            scoring: { type: "simple", points: 1 },
                                        });
                                    } else if (val === "long-answer") {
                                        updateQuestion({
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
                                {...form.getInputProps(`${path}.prompt`)}
                                key={form.key(`${path}.prompt`)}
                                label="Question Prompt"
                                minRows={2}
                                required
                                size="sm"
                            />

                            {renderQuestionTypeFields()}

                            <Textarea
                                {...form.getInputProps(`${path}.feedback`)}
                                key={form.key(`${path}.feedback`)}
                                label="Feedback (optional)"
                                description="Shown to students after answering"
                                minRows={2}
                                size="sm"
                            />

                            <ScoringEditor form={form} path={path} />
                        </Stack>
                    )}
                </Stack>
            </Card>
        </Box >
    );
}

// ============================================================================
// QUESTIONS LIST WITH DRAG AND DROP
// ============================================================================

export interface QuestionsListProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    path: "rawQuizConfig.pages" | `rawQuizConfig.nestedQuizzes.${number}.pages`;
}

export function QuestionsList({ form, path }: QuestionsListProps) {
    const mounted = useMounted();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Watch pages - only need IDs for performance
    const pagesData = useFormWatchForceUpdate(form, path, ({ previousValue, value }) => {
        const oldPages = previousValue.map((page) => ({
            id: page.id,
            title: page.title,
            questionIds: page.questions.map((q) => q.id),
        }));
        const newPages = value.map((page) => ({
            id: page.id,
            title: page.title,
            questionIds: page.questions.map((q) => q.id),
        }));
        return JSON.stringify(oldPages) !== JSON.stringify(newPages);
    });


    // Flatten pages and questions as a list of { type: "page" | "question", id: string, pageIndex?: number, questionIndex?: number }
    const flatListItems: Array<
        { type: "page"; id: string; pageIndex: number }
        | { type: "question"; id: string; pageIndex: number; questionIndex: number }
    > = [];
    // pagesData.forEach((page, pageIdx) => {
    //     page.questionIds.forEach((qId, qIdx) => {
    //         flatListItems.push({
    //             type: "question",
    //             id: qId,
    //             pageIndex: pageIdx,
    //             questionIndex: qIdx,
    //         });
    //     });
    //     if (pageIdx > 0)
    //         flatListItems.push({ type: "page", id: page.id, pageIndex: pageIdx });
    // });
    for (let i = 0; i < pagesData.length; i++) {
        const page = pagesData[i];
        if (i > 0) {
            flatListItems.push({ type: "page", id: page.id, pageIndex: i });
        }
        for (let j = 0; j < page.questions.length; j++) {
            flatListItems.push({ type: "question", id: page.questions[j].id, pageIndex: i, questionIndex: j });
        }
    }



    const totalQuestions = flatListItems.filter((item) => item.type === "question").length;
    const sortableIds = flatListItems.map((item) => item.id);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            setActiveId(null);
            return;
        }

        const oldIndex = sortableIds.indexOf(active.id as string);
        const newIndex = sortableIds.indexOf(over.id as string);

        if (oldIndex === -1 || newIndex === -1) {
            setActiveId(null);
            return;
        }

        // Step 1: Get current pages and build question ID map
        const currentPages = getPath(path, form.getValues()) as QuizPage[];

        // Build a map of question ID -> full question object
        const questionMap = new Map<string, Question>();
        currentPages.forEach((page) => {
            page.questions.forEach((question) => {
                questionMap.set(question.id, question);
            });
        });

        // Build a map of page ID -> page data
        const pageMap = new Map<string, { id: string; title: string }>();
        currentPages.forEach((page) => {
            pageMap.set(page.id, { id: page.id, title: page.title });
        });

        // Step 2: Reorder flat list
        const reorderedFlatList = arrayMove(flatListItems, oldIndex, newIndex);


        // Step 3: Reconstruct pages from reordered flat list
        const newPages: QuizPage[] = [];
        // add the first page 
        newPages.push({
            id: currentPages[0].id,
            title: currentPages[0].title,
            questions: [],
        });
        // loop through reordered flat list and add the questions or pages 
        let currentPage = 0;
        for (let i = 0; i < reorderedFlatList.length; i++) {
            const item = reorderedFlatList[i];
            if (item.type === "question") {
                newPages[currentPage].questions.push(questionMap.get(item.id)!);
            } else if (item.type === "page") {
                const page = pageMap.get(item.id)!;
                newPages.push({
                    id: page.id,
                    title: page.title,
                    questions: [],
                });
                currentPage++;
            }
        }

        console.log("new pages", newPages);
        // update the form
        form.setFieldValue(path, newPages);
        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const addQuestion = () => {
        const currentPages = (getPath(path, form.getValues()) as QuizPage[]) || [];
        const lastPageIndex = Math.max(0, currentPages.length - 1);

        const newQuestion: Question = {
            id: `question-${Date.now()}`,
            type: "multiple-choice",
            prompt: "",
            feedback: "",
            options: { a: "Option A", b: "Option B" },
            correctAnswer: "a",
            scoring: { type: "simple", points: 1 },
        };

        if (currentPages.length === 0) {
            // Create first page with the question
            form.setFieldValue(path, [
                {
                    id: `page-${Date.now()}`,
                    title: "Page 1",
                    questions: [newQuestion],
                },
            ]);
        } else {
            // Add to last page
            const updatedPages = [...currentPages];
            updatedPages[lastPageIndex] = {
                ...updatedPages[lastPageIndex],
                questions: [...updatedPages[lastPageIndex].questions, newQuestion],
            };
            form.setFieldValue(path, updatedPages);
        }
    };

    const addPageBreak = () => {
        const currentPages = (getPath(path, form.getValues()) as QuizPage[]) || [];
        if (currentPages.length === 0) return;

        const newPage: QuizPage = {
            id: `page-${Date.now()}`,
            title: `Page ${currentPages.length + 1}`,
            questions: [],
        };

        form.setFieldValue(path, [...currentPages, newPage]);
    };

    // Render helper - generates questions and page breaks from flat list
    const renderContent = () => {
        let questionNumber = 0;

        return flatListItems.map((item) => {
            if (item.type === "page") {
                return (
                    <SortablePageBreakItem
                        key={item.id}
                        form={form}
                        basePath={path}
                        id={item.id}
                        pageNumber={item.pageIndex}
                    />
                );
            }

            // Question item
            questionNumber++;
            const questionPath = `${path}.${item.pageIndex}.questions.${item.questionIndex}` as const

            return (
                <SortableQuestionItem
                    key={item.id}
                    form={form}
                    path={questionPath}
                    questionNumber={questionNumber}
                    pageNumber={item.pageIndex + 1}
                />
            );
        });
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

            {totalQuestions === 0 ? (
                <Paper withBorder p="xl" radius="md">
                    <Text ta="center" c="dimmed">
                        No questions yet. Click "Add Question" to get started.
                    </Text>
                </Paper>
            ) : !mounted ? (
                // Server-side render: static list without drag-and-drop
                <Stack gap="sm">{renderContent()}</Stack>
            ) : (
                // Client-side render: drag-and-drop enabled
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <Stack gap="sm">{renderContent()}</Stack>
                    </SortableContext>
                    <DragOverlay>
                        {activeId && <div>Dragging: {activeId}</div>}
                    </DragOverlay>
                </DndContext>
            )}
        </Stack>
    );
}
