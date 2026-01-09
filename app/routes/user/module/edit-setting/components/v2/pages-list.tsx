import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    DragStartEvent,
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
import { Group, Paper, Stack, Title } from "@mantine/core";
import { useReorderPages } from "app/routes/user/module/edit-setting/route";
import { useEffect, useState } from "react";
import { AddPageButton } from "./add-page-form";
import { PageForm } from "./page-form";
import { SortableItem } from "./sortable-item";
import type { QuizConfig, QuizPage } from "./types";

interface PagesListProps {
    moduleId: number;
    quizConfig: QuizConfig;
    nestedQuizId?: string;
}

export function PagesList({
    moduleId,
    quizConfig,
    nestedQuizId,
}: PagesListProps) {
    const { submit: reorderPages, isLoading: isReordering } = useReorderPages();
    const [activePageId, setActivePageId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActivePageId(event.active.id as string);
    };

    const pages: QuizPage[] =
        quizConfig.type === "regular"
            ? quizConfig.pages
            : nestedQuizId
                ? quizConfig.nestedQuizzes.find((nq) => nq.id === nestedQuizId)
                    ?.pages || []
                : [];

    // Local state for optimistic updates
    const [orderedPages, setOrderedPages] = useState(pages);

    // Sync local state with props when not reordering
    useEffect(() => {
        setOrderedPages(pages);
    }, [pages]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setOrderedPages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Trigger server action
                reorderPages({
                    params: { moduleId },
                    values: {
                        pageIds: newItems.map((p) => p.id),
                        nestedQuizId,
                    },
                });

                return newItems;
            });
        }
    };

    const handleDragCancel = () => {
        setActivePageId(null);
    };


    return (

        <Stack gap="md">
            <Title order={4}>Pages
                <AddPageButton moduleId={moduleId} nestedQuizId={nestedQuizId} />
            </Title>

            {orderedPages.length === 0 ? (
                <Paper withBorder p="xl" radius="md">
                    <p>No pages yet. Add a page above.</p>
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
                        items={orderedPages.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}

                    >
                        <Stack gap="md">
                            {orderedPages.map((page, index) => (
                                <SortableItem key={page.id} id={page.id}>

                                    <PageForm
                                        moduleId={moduleId}
                                        page={page}
                                        pageIndex={index}
                                        quizConfig={quizConfig}
                                        totalPages={orderedPages.length}
                                        nestedQuizId={nestedQuizId}
                                    />

                                </SortableItem>
                            ))}
                        </Stack>
                        <DragOverlay>
                            <div>Dragging: {activePageId}</div>
                        </DragOverlay>
                    </SortableContext>
                </DndContext>
            )}
        </Stack>

    );
}
