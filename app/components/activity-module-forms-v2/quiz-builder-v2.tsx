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
} from '@mantine/core';
import { useStore } from '@tanstack/react-store';
import { useState } from 'react';
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
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMounted } from '@mantine/hooks';
import {
    IconChevronDown,
    IconChevronUp,
    IconGripVertical,
    IconPlus,
    IconSeparator,
    IconTrash,
} from '@tabler/icons-react';
import type {
    GradingConfig,
    MultipleChoiceQuestion,
    NestedQuizConfig,
    Question,
    QuizConfig,
    ScoringConfig,
} from '~/components/activity-modules-preview/quiz-config.types';
import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

// ============================================================================
// TYPES FOR PAGE BREAK
// ============================================================================

type QuestionOrPageBreak =
    | { type: 'question'; data: Question, fieldPath: `rawQuizConfig.pages[${number}].questions[${number}]` | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]` }
    | { type: 'pageBreak'; id: string };

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
                    {(field) => (
                        <field.CheckboxField label="Enable Grading" />
                    )}
                </form.AppField>

                {/* Conditional Grading Options */}
                <form.Subscribe selector={(state) => state.values.rawQuizConfig?.grading?.enabled}>
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

// Nested quiz grading editor (uses useStore for reactive grading enabled state)
function NestedGradingConfigEditor({
    form,
    quizIndex,
}: {
    form: UpdateModuleFormApi;
    quizIndex: number;
}) {
    const basePath = `rawQuizConfig.nestedQuizzes[${quizIndex}].grading` as const;

    // Reactively derive grading enabled state using useStore
    const gradingEnabled = useStore(form.store, (state) => {
        const grading = state.values.rawQuizConfig?.nestedQuizzes?.[quizIndex]?.grading as GradingConfig | undefined;
        return grading?.enabled || false;
    });

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
                <Title order={5}>Grading Configuration</Title>

                {/* Enable Grading Checkbox */}
                <form.AppField name={`${basePath}.enabled`}>
                    {(field) => (
                        <field.CheckboxField label="Enable Grading" />
                    )}
                </form.AppField>

                {/* Conditional Grading Options */}
                {gradingEnabled && (
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
    questionType: Question['type'];
    scoring: ScoringConfig | undefined;
    onChange: (scoring: ScoringConfig) => void;
}) {
    const defaultScoring: ScoringConfig =
        questionType === 'long-answer'
            ? { type: 'manual', maxPoints: 1 }
            : { type: 'simple', points: 1 };

    const currentScoring = scoring || defaultScoring;

    if (currentScoring.type === 'simple') {
        return (
            <NumberInput
                label="Points"
                description="Points awarded for correct answer"
                value={currentScoring.points}
                onChange={(val) =>
                    onChange({ type: 'simple', points: typeof val === 'number' ? val : 1 })
                }
                min={0}
                size="sm"
            />
        );
    }

    if (currentScoring.type === 'manual') {
        return (
            <NumberInput
                label="Maximum Points"
                description="Maximum points for manual grading"
                value={currentScoring.maxPoints}
                onChange={(val) =>
                    onChange({
                        type: 'manual',
                        maxPoints: typeof val === 'number' ? val : 1,
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
            options: { ...options, [nextKey]: '' },
        });
    };

    const removeOption = (key: string) => {
        const newOptions = { ...options };
        delete newOptions[key];
        onChange({
            ...question,
            options: newOptions,
            correctAnswer: question.correctAnswer === key ? undefined : question.correctAnswer,
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
// SORTABLE PAGE BREAK
// ============================================================================

type SortablePageBreakItemProps = {
    item: { type: 'pageBreak'; id: string };
    onRemove: () => void;
}

function SortablePageBreakItem({ item, onRemove }: SortablePageBreakItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };
    return <Box ref={setNodeRef} style={style}>
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
}

// ============================================================================
// DRAG OVERLAY PREVIEW
// ============================================================================

interface DragOverlayPreviewProps {
    activeItem: QuestionOrPageBreak | null;
    items: QuestionOrPageBreak[];
}

function DragOverlayPreview({ activeItem, items }: DragOverlayPreviewProps) {
    if (!activeItem) return null;

    if (activeItem.type === 'pageBreak') {
        return (
            <Paper
                withBorder
                p="sm"
                radius="md"
                bg="gray.0"
                style={{ cursor: 'grabbing' }}
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

    // Question preview
    const questionNumber = items
        .slice(
            0,
            items.findIndex(
                (i) =>
                    i.type === 'question' &&
                    i.data.id === activeItem.data.id,
            ) + 1,
        )
        .filter((i) => i.type === 'question').length;

    const questionTypeLabel =
        activeItem.data.type === 'multiple-choice'
            ? 'Multiple Choice'
            : activeItem.data.type === 'short-answer'
                ? 'Short Answer'
                : 'Long Answer';

    return (
        <Card withBorder radius="md" p="md" style={{ cursor: 'grabbing' }}>
            <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" style={{ flex: 1 }}>
                    <IconGripVertical size={16} />
                    <Text fw={500} size="sm">
                        Question {questionNumber}: {questionTypeLabel}
                    </Text>
                    {activeItem.data.prompt && (
                        <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                            {activeItem.data.prompt}
                        </Text>
                    )}
                </Group>
            </Group>
        </Card>
    );
}


// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================


function getNestedQuizIndex(questionFieldPath: `rawQuizConfig.pages[${number}].questions[${number}]` | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`): number | undefined {
    const match = questionFieldPath.match(/rawQuizConfig\.nestedQuizzes\[(\d+)\]/);
    if (match) {
        return Number.parseInt(match[1], 10);
    }
    return undefined;
}

function getPageIndex(questionFieldPath: `rawQuizConfig.pages[${number}].questions[${number}]` | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`): number {
    const isNestedQuiz = questionFieldPath.includes('nestedQuizzes');
    if (isNestedQuiz) {
        const match = questionFieldPath.match(/rawQuizConfig\.nestedQuizzes\[(\d+)\]\.pages\[(\d+)\]/);
        if (match) {
            return Number.parseInt(match[2], 10);
        }
    } else {
        const match = questionFieldPath.match(/rawQuizConfig\.pages\[(\d+)\]/);
        if (match) {
            return Number.parseInt(match[1], 10);
        }
    }
    throw new Error(`Page index not found in question field path ${questionFieldPath}`);
}

function getQuestionIndex(questionFieldPath: `rawQuizConfig.pages[${number}].questions[${number}]` | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`): number {
    const isNestedQuiz = questionFieldPath.includes('nestedQuizzes');
    if (isNestedQuiz) {
        const match = questionFieldPath.match(/rawQuizConfig\.nestedQuizzes\[(\d+)\]\.pages\[(\d+)\]\.questions\[(\d+)\]/);
        if (match) {
            return Number.parseInt(match[3], 10);
        }
    } else {
        const match = questionFieldPath.match(/rawQuizConfig\.pages\[(\d+)\]\.questions\[(\d+)\]/);
        if (match) {
            return Number.parseInt(match[2], 10);
        }
    }
    throw new Error(`Question index not found in question field path ${questionFieldPath}`);
}

interface SortableQuestionItemProps {
    form: UpdateModuleFormApi;
    questionFieldPath: `rawQuizConfig.pages[${number}].questions[${number}]` | `rawQuizConfig.nestedQuizzes[${number}].pages[${number}].questions[${number}]`; // e.g., "rawQuizConfig.pages[0].questions[2]"
    item: Extract<QuestionOrPageBreak, { type: 'question' }>;
    onRemove: () => void;
}

function SortableQuestionItem({
    form,
    questionFieldPath,
    item,
    onRemove,
}: SortableQuestionItemProps) {
    const isNestedQuiz = questionFieldPath.includes('nestedQuizzes')
    const nestedQuizIndex = isNestedQuiz ? getNestedQuizIndex(questionFieldPath) : undefined;
    const pageIndex = getPageIndex(questionFieldPath)
    const questionIndex = getQuestionIndex(questionFieldPath)
    const [isExpanded, setIsExpanded] = useState(true);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: item.data.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    // Get question data reactively from form store
    const question = useStore(form.store, (state) => {
        const value = nestedQuizIndex ? state.values.rawQuizConfig?.nestedQuizzes?.[nestedQuizIndex]?.pages?.[pageIndex]?.questions?.[questionIndex] : state.values.rawQuizConfig?.pages?.[pageIndex]?.questions?.[questionIndex];
        if (!value) {
            console.error(`Question not found at path ${questionFieldPath} for page ${pageIndex} in ${isNestedQuiz ? 'nested quiz' : 'regular quiz'}: ${nestedQuizIndex} ${pageIndex} ${questionIndex}`);
            console.error('state', state.values.rawQuizConfig);
        }
        return value;
    });

    if (!question) {
        return null; // throw new Error(`Question not found at path ${questionFieldPath} for page ${pageIndex} in ${isNestedQuiz ? 'nested quiz' : 'regular quiz'}: ${nestedQuizIndex} ${pageIndex} ${questionIndex}`);
    }

    // Helper to update question using the field path
    const updateQuestion = (updated: Question) => {
        form.setFieldValue(questionFieldPath, updated);
    };

    const renderQuestionTypeFields = () => {
        switch (question.type) {
            case 'multiple-choice':
                return (
                    <MultipleChoiceEditor
                        question={question as MultipleChoiceQuestion}
                        onChange={updateQuestion}
                    />
                );

            case 'short-answer':
                return (
                    <TextInput
                        label="Correct Answer (optional)"
                        description="For automatic grading (exact match)"
                        value={question.correctAnswer || ''}
                        onChange={(e) =>
                            updateQuestion({
                                ...question,
                                correctAnswer: e.currentTarget.value,
                            })
                        }
                        size="sm"
                    />
                );

            case 'long-answer':
                return (
                    <Textarea
                        label="Sample/Expected Answer (optional)"
                        description="For reference purposes (requires manual grading)"
                        value={question.correctAnswer || ''}
                        onChange={(e) =>
                            updateQuestion({
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
        question.type === 'multiple-choice'
            ? 'Multiple Choice'
            : question.type === 'short-answer'
                ? 'Short Answer'
                : 'Long Answer';

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
                                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                            >
                                <IconGripVertical size={16} />
                            </ActionIcon>
                            <Text fw={500} size="sm">
                                Question {questionIndex + 1}: {questionTypeLabel}
                            </Text>
                            {!isExpanded && question.prompt && (
                                <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                                    {question.prompt}
                                </Text>
                            )}
                        </Group>
                        <Group gap="xs">
                            <ActionIcon variant="subtle" onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
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
                                onChange={(val: string | null) => {
                                    const baseQuestion = {
                                        id: question.id,
                                        prompt: question.prompt,
                                        feedback: question.feedback,
                                        type: val as Question['type'],
                                    };

                                    if (val === 'multiple-choice') {
                                        updateQuestion({
                                            ...baseQuestion,
                                            type: 'multiple-choice',
                                            options: { a: 'Option A', b: 'Option B' },
                                            correctAnswer: 'a',
                                            scoring: { type: 'simple', points: 1 },
                                        });
                                    } else if (val === 'short-answer') {
                                        updateQuestion({
                                            ...baseQuestion,
                                            type: 'short-answer',
                                            correctAnswer: '',
                                            scoring: { type: 'simple', points: 1 },
                                        });
                                    } else if (val === 'long-answer') {
                                        updateQuestion({
                                            ...baseQuestion,
                                            type: 'long-answer',
                                            correctAnswer: '',
                                            scoring: { type: 'manual', maxPoints: 1 },
                                        });
                                    }
                                }}
                                data={[
                                    { value: 'multiple-choice', label: 'Multiple Choice' },
                                    { value: 'short-answer', label: 'Short Answer' },
                                    { value: 'long-answer', label: 'Long Answer' },
                                ]}
                                size="sm"
                            />

                            <Textarea
                                label="Question Prompt"
                                value={question.prompt}
                                onChange={(e) => updateQuestion({ ...question, prompt: e.currentTarget.value })}
                                minRows={2}
                                required
                                size="sm"
                            />

                            {renderQuestionTypeFields()}

                            <Textarea
                                label="Feedback (optional)"
                                description="Shown to students after answering"
                                value={question.feedback || ''}
                                onChange={(e) => updateQuestion({ ...question, feedback: e.currentTarget.value })}
                                minRows={2}
                                size="sm"
                            />

                            <ScoringEditor
                                questionType={question.type}
                                scoring={question.scoring}
                                onChange={(scoring) => updateQuestion({ ...question, scoring })}
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
    pagesFieldName: 'rawQuizConfig.pages' | `rawQuizConfig.nestedQuizzes[${number}].pages`; // e.g., "rawQuizConfig.pages" or "rawQuizConfig.nestedQuizzes[0].pages"
}

function QuestionsList({ form, pagesFieldName }: QuestionsListProps) {
    const mounted = useMounted();
    const [activeId, setActiveId] = useState<string | null>(null);
    const isNestedQuiz = pagesFieldName.includes('nestedQuizzes');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Use useStore to get pages reactively from form
    const pages = useStore(form.store, (state) => {
        // Dynamically access the nested field based on pagesFieldName
        if (pagesFieldName === 'rawQuizConfig.pages') {
            return state.values.rawQuizConfig?.pages ?? [];
        }
        // For nested quiz pages like "rawQuizConfig.nestedQuizzes[0].pages"
        const match = pagesFieldName.match(/rawQuizConfig\.nestedQuizzes\[(\d+)\]\.pages/);
        if (match) {
            const index = Number.parseInt(match[1], 10);
            return state.values.rawQuizConfig?.nestedQuizzes?.[index]?.pages ?? [];
        }
        return [];
    });

    // Convert pages structure to flat list with page breaks
    const pagesToItems = (pages: QuizConfig['pages']): QuestionOrPageBreak[] => {
        const result: QuestionOrPageBreak[] = [];
        if (!pages) return result;

        pages.forEach((page, pageIndex) => {
            page.questions.forEach((question) => {
                const questionIndex = page.questions.indexOf(question);
                result.push({ type: 'question', data: question, fieldPath: `${pagesFieldName}[${pageIndex}].questions[${questionIndex}]` });
            });

            // Add page break between pages (but not after the last page)
            if (pageIndex < pages.length - 1) {
                result.push({ type: 'pageBreak', id: `pageBreak-${pageIndex}` });
            }
        });

        return result;
    };

    // Convert flat list back to pages structure
    const itemsToPages = (items: QuestionOrPageBreak[]): QuizConfig['pages'] => {
        if (items.length === 0) {
            return [];
        }

        const pages: QuizConfig['pages'] = [];
        let currentPage: Question[] = [];

        items.forEach((item) => {
            if (item.type === 'question') {
                currentPage.push(item.data);
            } else if (item.type === 'pageBreak') {
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

    // Compute items from pages
    const items = pagesToItems(pages);

    // Calculate field path for each question
    const getQuestionFieldPath = (item: Extract<QuestionOrPageBreak, { type: 'question' }>) => {

        const questionId = item.data.id;

        // Find which page and which question index this question is at
        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];
            const questionIndex = page.questions.findIndex((q) => q.id === questionId);

            if (questionIndex !== -1) {
                return `${pagesFieldName}[${pageIndex}].questions[${questionIndex}]` as const;
            }
        }

        throw new Error(`Question not found with id ${questionId} in pages ${pages.map((p) => p.id).join(', ')}`);

    };

    // Handler functions at component level
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) =>
                item.type === 'question' ? item.data.id === active.id : item.id === active.id,
            );
            const newIndex = items.findIndex((item) =>
                item.type === 'question' ? item.data.id === over.id : item.id === over.id,
            );

            const newItems = arrayMove(items, oldIndex, newIndex);
            const newPages = itemsToPages(newItems);
            form.setFieldValue(pagesFieldName, newPages);
        }

        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const activeItem: QuestionOrPageBreak | null = activeId
        ? items.find((item) =>
            item.type === 'question' ? item.data.id === activeId : item.id === activeId,
        ) || null
        : null;

    const addQuestion = () => {
        const questionNumber = items.filter((i) => i.type === 'question').length;
        const newQuestion: QuestionOrPageBreak = {
            type: 'question',
            fieldPath: `${pagesFieldName}[${pages.length}].questions[${questionNumber}]`,
            data: {
                id: `question-${Date.now()}`,
                type: 'multiple-choice',
                prompt: '',
                options: { a: 'Option A', b: 'Option B' },
                correctAnswer: 'a',
                scoring: { type: 'simple', points: 1 },
            },
        };
        const newItems = [...items, newQuestion];
        const newPages = itemsToPages(newItems);
        form.setFieldValue(pagesFieldName, newPages);
    };

    const addPageBreak = () => {
        const newPageBreak: QuestionOrPageBreak = {
            type: 'pageBreak',
            id: `pageBreak-${Date.now()}`,
        };
        const newItems = [...items, newPageBreak];
        const newPages = itemsToPages(newItems);
        form.setFieldValue(pagesFieldName, newPages);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        const newPages = itemsToPages(newItems);
        form.setFieldValue(pagesFieldName, newPages);
    };

    function getQuestionNumber(item: Extract<QuestionOrPageBreak, { type: 'question' }>) {
        return items.findIndex((i) => i.type === 'question' && i.data.id === item.data.id);
    }

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
                        return (
                            <div key={item.type === 'question' ? item.data.id : item.id}>
                                {item.type === 'question' ? (
                                    <SortableQuestionItem
                                        form={form}
                                        questionFieldPath={getQuestionFieldPath(item)}
                                        item={item}
                                        onRemove={() => removeItem(index)}
                                    />
                                ) : (
                                    <SortablePageBreakItem item={item} onRemove={() => removeItem(index)} />
                                )}
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
                            item.type === 'question' ? item.data.id : item.id,
                        )}
                        strategy={verticalListSortingStrategy}
                    >
                        <Stack gap="sm">
                            {items.map((item, index) => {


                                return item.type === 'question' ? (
                                    <SortableQuestionItem
                                        key={item.data.id}
                                        form={form}
                                        questionFieldPath={getQuestionFieldPath(item)}
                                        item={item}
                                        onRemove={() => removeItem(index)}
                                    />
                                ) : (
                                    <SortablePageBreakItem key={item.id} item={item} onRemove={() => removeItem(index)} />
                                );
                            })}
                        </Stack>
                    </SortableContext>
                    <DragOverlay>
                        <DragOverlayPreview activeItem={activeItem} items={items} />
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
                {(field) => (
                    <field.TextInputField label="Quiz Title" />
                )}
            </form.AppField>

            <form.AppField name={`${basePath}.description`}>
                {(field) => (
                    <field.TextareaField
                        label="Description (optional)"
                        minRows={2}
                    />
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
    // Derive initial active tab from form state
    const initialTab = useStore(form.store, (state) => {
        const quizzes = state.values.rawQuizConfig?.nestedQuizzes || [];
        return quizzes[0]?.id || null;
    });

    const [activeTab, setActiveTab] = useState<string | null>(initialTab);

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
                                                <Title order={5}>{quiz.title || `Quiz ${index + 1}`}</Title>
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
                {(field) => <field.TextInputField label="Container Quiz Title" required />}
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

