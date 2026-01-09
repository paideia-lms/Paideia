import { Group, Paper, Stack, Title } from "@mantine/core";
import type { QuizConfig, QuizPage } from "./types";
import { PageForm } from "./page-form";
import { AddPageForm } from "./add-page-form";
import { RemovePageButton } from "./remove-page-button";

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
    const pages: QuizPage[] =
        quizConfig.type === "regular"
            ? quizConfig.pages
            : (nestedQuizId
                ? (quizConfig.nestedQuizzes.find(nq => nq.id === nestedQuizId)?.pages || [])
                : []);

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="md">
                <Title order={4}>Pages</Title>

                <AddPageForm moduleId={moduleId} nestedQuizId={nestedQuizId} />

                {pages.length === 0 ? (
                    <Paper withBorder p="xl" radius="md">
                        <p>No pages yet. Add a page above.</p>
                    </Paper>
                ) : (
                    <Stack gap="md">
                        {pages.map((page, index) => (
                            <Group key={page.id} align="flex-start" wrap="nowrap">
                                <div style={{ flex: 1 }}>
                                    <PageForm
                                        moduleId={moduleId}
                                        page={page}
                                        pageIndex={index}
                                        quizConfig={quizConfig}
                                        nestedQuizId={nestedQuizId}
                                    />
                                </div>
                                <RemovePageButton
                                    moduleId={moduleId}
                                    pageId={page.id}
                                    nestedQuizId={nestedQuizId}
                                    disabled={pages.length <= 1}
                                />
                            </Group>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}
