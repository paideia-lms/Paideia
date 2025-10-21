import type {
    AppState,
    BinaryFiles,
    ExcalidrawImperativeAPI,
    ExcalidrawInitialDataState,
    ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import {
    Box,
    Checkbox,
    Group,
    Loader,
    Radio,
    Select,
    Stack,
    Table,
    Text,
    Textarea,
    TextInput,
    useMantineColorScheme,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical } from "@tabler/icons-react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import type {
    ArticleQuestion,
    ChoiceQuestion,
    FillInTheBlankQuestion,
    LongAnswerQuestion,
    MultipleChoiceQuestion,
    MultipleSelectionMatrixQuestion,
    Question,
    RankingQuestion,
    ShortAnswerQuestion,
    SingleSelectionMatrixQuestion,
    WhiteboardQuestion,
} from "./quiz-config.types";
import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
    import("@excalidraw/excalidraw").then((module) => ({
        default: module.Excalidraw,
    })),
);

interface QuestionRendererProps {
    question: Question;
    value: unknown;
    onChange: (value: unknown) => void;
    showFeedback: boolean;
    disabled?: boolean;
}

export function QuestionRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled = false,
}: QuestionRendererProps) {
    switch (question.type) {
        case "multiple-choice":
            return (
                <MultipleChoiceRenderer
                    question={question}
                    value={value as string}
                    onChange={onChange as (value: string) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "short-answer":
            return (
                <ShortAnswerRenderer
                    question={question}
                    value={value as string}
                    onChange={onChange as (value: string) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "long-answer":
            return (
                <LongAnswerRenderer
                    question={question}
                    value={value as string}
                    onChange={onChange as (value: string) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "article":
            return (
                <ArticleRenderer
                    question={question}
                    value={value as string}
                    onChange={onChange as (value: string) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "fill-in-the-blank":
            return (
                <FillInTheBlankRenderer
                    question={question}
                    value={value as string[]}
                    onChange={onChange as (value: string[]) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "choice":
            return (
                <ChoiceRenderer
                    question={question}
                    value={value as string[]}
                    onChange={onChange as (value: string[]) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "ranking":
            return (
                <RankingRenderer
                    question={question}
                    value={value as string[]}
                    onChange={onChange as (value: string[]) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "single-selection-matrix":
            return (
                <SingleSelectionMatrixRenderer
                    question={question}
                    value={value as Record<string, string>}
                    onChange={onChange as (value: Record<string, string>) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "multiple-selection-matrix":
            return (
                <MultipleSelectionMatrixRenderer
                    question={question}
                    value={value as Record<string, string>}
                    onChange={onChange as (value: Record<string, string>) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        case "whiteboard":
            return (
                <WhiteboardRenderer
                    question={question}
                    value={value as string}
                    onChange={onChange as (value: string) => void}
                    showFeedback={showFeedback}
                    disabled={disabled}
                />
            );
        default:
            return <Text c="red">Unknown question type</Text>;
    }
}

// Multiple Choice Renderer
function MultipleChoiceRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: MultipleChoiceQuestion;
    value: string;
    onChange: (value: string) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    return (
        <Stack gap="sm">
            <Radio.Group value={value || ""} onChange={onChange}>
                <Stack gap="xs">
                    {Object.entries(question.options).map(([key, label]) => (
                        <Radio
                            key={key}
                            value={key}
                            label={label}
                            disabled={disabled}
                        />
                    ))}
                </Stack>
            </Radio.Group>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Short Answer Renderer
function ShortAnswerRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: ShortAnswerQuestion;
    value: string;
    onChange: (value: string) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    return (
        <Stack gap="sm">
            <TextInput
                value={value || ""}
                onChange={(e) => onChange(e.currentTarget.value)}
                placeholder="Enter your answer"
                disabled={disabled}
            />
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Long Answer Renderer
function LongAnswerRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: LongAnswerQuestion;
    value: string;
    onChange: (value: string) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    return (
        <Stack gap="sm">
            <Textarea
                value={value || ""}
                onChange={(e) => onChange(e.currentTarget.value)}
                placeholder="Enter your answer"
                minRows={4}
                disabled={disabled}
            />
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Article Renderer
function ArticleRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: ArticleQuestion;
    value: string;
    onChange: (value: string) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    return (
        <Stack gap="sm">
            <SimpleRichTextEditor
                content={value || ""}
                onChange={onChange}
                placeholder="Write your article here..."
                readonly={disabled}
            />
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Fill in the Blank Renderer
function FillInTheBlankRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: FillInTheBlankQuestion;
    value: string[];
    onChange: (value: string[]) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    // Parse the prompt to find blanks
    const parts = question.prompt.split(/(\{\{blank\}\})/g);
    const blanks = parts.filter((part) => part === "{{blank}}");
    const blankCount = blanks.length;

    // Initialize answers array if not present
    const answers = value || Array(blankCount).fill("");

    const handleBlankChange = (index: number, blankValue: string) => {
        const newAnswers = [...answers];
        newAnswers[index] = blankValue;
        onChange(newAnswers);
    };

    let blankIndex = 0;

    return (
        <Stack gap="sm">
            <Group gap="xs" style={{ flexWrap: "wrap", alignItems: "center" }}>
                {parts.map((part, partIndex) => {
                    if (part === "{{blank}}") {
                        const currentBlankIndex = blankIndex;
                        blankIndex++;
                        return (
                            <TextInput
                                key={`${question.id}-blank-${currentBlankIndex}`}
                                value={answers[currentBlankIndex] || ""}
                                onChange={(e) =>
                                    handleBlankChange(currentBlankIndex, e.currentTarget.value)
                                }
                                placeholder={`Blank ${currentBlankIndex + 1}`}
                                style={{ width: 150 }}
                                disabled={disabled}
                            />
                        );
                    }
                    if (part) {
                        return (
                            <Text key={`${question.id}-text-${partIndex}`} span>
                                {part}
                            </Text>
                        );
                    }
                    return null;
                })}
            </Group>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Choice Renderer (Multiple Selection with Checkboxes)
function ChoiceRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: ChoiceQuestion;
    value: string[];
    onChange: (value: string[]) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    return (
        <Stack gap="sm">
            <Checkbox.Group value={value || []} onChange={onChange}>
                <Stack gap="xs">
                    {Object.entries(question.options).map(([key, label]) => (
                        <Checkbox
                            key={key}
                            value={key}
                            label={label}
                            disabled={disabled}
                        />
                    ))}
                </Stack>
            </Checkbox.Group>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Sortable Item for Ranking
function SortableItem({
    id,
    item,
    index,
    disabled,
}: { id: string; item: string; index: number; disabled: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <Group
            ref={setNodeRef}
            gap="sm"
            p="sm"
            style={{
                ...style,
                backgroundColor: "var(--mantine-color-default)",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: "var(--mantine-radius-sm)",
                cursor: disabled ? "default" : "grab",
            }}
        >
            {!disabled && (
                <IconGripVertical
                    size={18}
                    {...attributes}
                    {...listeners}
                    style={{ cursor: "grab" }}
                />
            )}
            <Text fw={500} size="sm">
                {index + 1}.
            </Text>
            <Text>{item}</Text>
        </Group>
    );
}

// Ranking Renderer
function RankingRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: RankingQuestion;
    value: string[];
    onChange: (value: string[]) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    // Initialize with question item keys if no value
    const itemKeys = Object.keys(question.items);
    const items = value && value.length > 0 ? value : itemKeys;

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);

            const newItems = [...items];
            const [movedItem] = newItems.splice(oldIndex, 1);
            newItems.splice(newIndex, 0, movedItem);

            onChange(newItems);
        }
    };

    return (
        <Stack gap="sm">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs">
                        {items.map((itemKey, index) => (
                            <SortableItem
                                key={itemKey}
                                id={itemKey}
                                item={question.items[itemKey]}
                                index={index}
                                disabled={disabled}
                            />
                        ))}
                    </Stack>
                </SortableContext>
            </DndContext>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Single Selection Matrix Renderer
function SingleSelectionMatrixRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: SingleSelectionMatrixQuestion;
    value: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    const answers = value || {};

    const handleChange = (rowKey: string, columnKey: string) => {
        onChange({
            ...answers,
            [rowKey]: columnKey,
        });
    };

    return (
        <Stack gap="sm">
            <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th />
                        {Object.entries(question.columns).map(([columnKey, columnLabel]) => (
                            <Table.Th key={columnKey}>{columnLabel}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {Object.entries(question.rows).map(([rowKey, rowLabel]) => (
                        <Table.Tr key={rowKey}>
                            <Table.Td>{rowLabel}</Table.Td>
                            {Object.keys(question.columns).map((columnKey) => (
                                <Table.Td key={`${rowKey}-${columnKey}`}>
                                    <Radio
                                        checked={answers[rowKey] === columnKey}
                                        onChange={() => handleChange(rowKey, columnKey)}
                                        disabled={disabled}
                                    />
                                </Table.Td>
                            ))}
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Multiple Selection Matrix Renderer
function MultipleSelectionMatrixRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: MultipleSelectionMatrixQuestion;
    value: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    const answers = value || {};

    const handleChange = (rowKey: string, selectedValue: string | null) => {
        const newAnswers = { ...answers };
        if (selectedValue) {
            newAnswers[rowKey] = selectedValue;
        } else {
            delete newAnswers[rowKey];
        }
        onChange(newAnswers);
    };

    // Convert columns object to Mantine Select data format
    const columnData = Object.entries(question.columns).map(([key, label]) => ({
        value: key,
        label: label,
    }));

    return (
        <Stack gap="sm">
            <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Question</Table.Th>
                        <Table.Th>Answer</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {Object.entries(question.rows).map(([rowKey, rowLabel]) => (
                        <Table.Tr key={rowKey}>
                            <Table.Td>{rowLabel}</Table.Td>
                            <Table.Td>
                                <Select
                                    value={answers[rowKey] || null}
                                    onChange={(val) => handleChange(rowKey, val)}
                                    data={columnData}
                                    placeholder="Select an option"
                                    disabled={disabled}
                                    clearable
                                />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

// Whiteboard Renderer
function WhiteboardRenderer({
    question,
    value,
    onChange,
    showFeedback,
    disabled,
}: {
    question: WhiteboardQuestion;
    value: string;
    onChange: (value: string) => void;
    showFeedback: boolean;
    disabled: boolean;
}) {
    const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const { colorScheme } = useMantineColorScheme();
    const [initialData, setInitialData] =
        useState<ExcalidrawInitialDataState | null>(null);
    const [isClient, setIsClient] = useState(false);

    // Ensure we're on the client side
    useLayoutEffect(() => {
        setIsClient(true);
    }, []);

    // Load initial data from value
    // biome-ignore lint/correctness/useExhaustiveDependencies: only load when question changes
    useLayoutEffect(() => {
        if (value && value.trim().length > 0) {
            try {
                const data = JSON.parse(value) as ExcalidrawInitialDataState;
                // Ensure appState has the required structure
                setInitialData({
                    ...data,
                    appState: {
                        ...data.appState,
                        collaborators: new Map(),
                        viewBackgroundColor: colorScheme === "dark" ? "#1a1b1e" : "#ffffff",
                    },
                });
            } catch {
                console.error("Failed to load whiteboard data");
                setInitialData({
                    appState: {
                        collaborators: new Map(),
                        viewBackgroundColor: colorScheme === "dark" ? "#1a1b1e" : "#ffffff",
                    },
                });
            }
        } else {
            setInitialData({
                appState: {
                    collaborators: new Map(),
                    viewBackgroundColor: colorScheme === "dark" ? "#1a1b1e" : "#ffffff",
                },
            });
        }
    }, [question.id, colorScheme]);

    // Sync theme with Mantine's color scheme
    useLayoutEffect(() => {
        if (excalidrawRef.current) {
            const theme = colorScheme === "dark" ? "dark" : "light";
            excalidrawRef.current.updateScene({
                appState: {
                    theme,
                    viewBackgroundColor: colorScheme === "dark" ? "#1a1b1e" : "#ffffff",
                },
            });
        }
    }, [colorScheme]);

    // Create a debounced callback to save the whiteboard state
    const saveSnapshot = useDebouncedCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        // Check if there are any non-deleted elements
        const elementList = elements;
        const hasContent = Array.isArray(elementList) &&
            elementList.length > 0 &&
            elementList.filter((element) => !element.isDeleted).length > 0;

        if (!hasContent) {
            // If no content, clear the value
            onChange(undefined as unknown as string);
        } else {
            const data = {
                elements,
                appState,
                files,
            };
            onChange(JSON.stringify(data));
        }
    }, 500);

    return (
        <Stack gap="sm">
            <Box style={{ height: "500px", border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-sm)" }}>
                {initialData === null || !isClient ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                        }}
                    >
                        <Loader />
                    </div>
                ) : (
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
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
                            onChange={(elements, appState, files) => {
                                if (!disabled) {
                                    saveSnapshot(elements, appState, files);
                                }
                            }}
                            theme={colorScheme === "dark" ? "dark" : "light"}
                            viewModeEnabled={disabled}
                        />
                    </Suspense>
                )}
            </Box>
            {showFeedback && question.feedback && (
                <Text size="sm" c="dimmed">
                    {question.feedback}
                </Text>
            )}
        </Stack>
    );
}

