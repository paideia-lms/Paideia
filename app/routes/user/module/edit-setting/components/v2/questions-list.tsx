import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    type DragStartEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
    ActionIcon,
    Collapse,
    Group,
    Paper,
    Stack,
    Title,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useMoveQuestionToPage } from "app/routes/user/module/edit-setting/route";
import { useEffect, useState } from "react";
import { AddQuestionForm } from "./add-question-form";
import { QuestionForm } from "./question-form";
import { SortableItem } from "./sortable-item";
import type { QuizConfig, QuizPage } from "./types";

interface QuestionsListProps {
    moduleId: number;
    page: QuizPage;
    pageIndex: number;
    quizConfig: QuizConfig;
    nestedQuizId?: string;
}

export function QuestionsList({
    moduleId,
    page,
    quizConfig,
    nestedQuizId,
}: QuestionsListProps) {
    const { submit: moveQuestion } = useMoveQuestionToPage();
    const questions = page.questions || [];

    // Local state for optimistic updates
    const [orderedQuestions, setOrderedQuestions] = useState(questions);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveQuestionId(event.active.id as string);
    };

    const handleDragCancel = () => {
        setActiveQuestionId(null);
    };

    // Sync local state with props when data changes
    useEffect(() => {
        setOrderedQuestions(questions);
    }, [questions]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = orderedQuestions.findIndex((q) => q.id === active.id);
            const newIndex = orderedQuestions.findIndex((q) => q.id === over.id);

            setOrderedQuestions((items) => arrayMove(items, oldIndex, newIndex));

            // Trigger server action to update position
            moveQuestion({
                params: { moduleId },
                values: {
                    questionId: active.id as string,
                    targetPageId: page.id,
                    position: newIndex,
                    nestedQuizId,
                },
            });
        }
    };

    return (
        <Stack gap="md">

            <Title order={5}>Questions

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
            </Title>


            <Collapse in={isExpanded}>
                <Stack gap="md">
                    <AddQuestionForm
                        moduleId={moduleId}
                        pageId={page.id}
                        nestedQuizId={nestedQuizId}
                    />

                    {orderedQuestions.length === 0 ? (
                        <Paper withBorder p="xl" radius="md">
                            <p>No questions yet. Add a question above.</p>
                        </Paper>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                            onDragCancel={handleDragCancel}
                        >
                            <SortableContext
                                items={orderedQuestions.map((q) => q.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Stack gap="md">
                                    {orderedQuestions.map((question, index) => (
                                        <SortableItem key={question.id} id={question.id}>
                                            <QuestionForm
                                                moduleId={moduleId}
                                                question={question}
                                                questionIndex={index}
                                                quizConfig={quizConfig}
                                                nestedQuizId={nestedQuizId}
                                            />
                                        </SortableItem>
                                    ))}
                                </Stack>
                                <DragOverlay>
                                    {activeQuestionId && <div>Dragging: {activeQuestionId}</div>}
                                </DragOverlay>
                            </SortableContext>
                        </DndContext>
                    )}
                </Stack>
            </Collapse>
        </Stack>
    );
}
