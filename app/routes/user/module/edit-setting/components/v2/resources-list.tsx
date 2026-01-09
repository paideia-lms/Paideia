import { Paper, Stack, Title } from "@mantine/core";
import type { QuizConfig, QuizPage } from "./types";
import { AddQuizResourceButton } from "./add-quiz-resource-form";
import { UpdateQuizResourceForm } from "./update-quiz-resource-form";
import { Group } from "@mantine/core";

interface ResourcesListProps {
    moduleId: number;
    quizConfig: QuizConfig;
    nestedQuizId?: string;
}

export function ResourcesList({
    moduleId,
    quizConfig,
    nestedQuizId,
}: ResourcesListProps) {
    const resources =
        quizConfig.type === "regular"
            ? (quizConfig.resources || [])
            : (nestedQuizId
                ? (quizConfig.nestedQuizzes.find(nq => nq.id === nestedQuizId)?.resources || [])
                : []);

    const pages: QuizPage[] =
        quizConfig.type === "regular"
            ? quizConfig.pages
            : (nestedQuizId
                ? (quizConfig.nestedQuizzes.find(nq => nq.id === nestedQuizId)?.pages || [])
                : []);

    return (

        <Stack gap="md">
            <Title order={4}>Resources
                <AddQuizResourceButton moduleId={moduleId} nestedQuizId={nestedQuizId} />
            </Title>



            {resources.length === 0 ? (
                <Paper withBorder p="xl" radius="md">
                    <p>No resources yet. Add a resource above.</p>
                </Paper>
            ) : (
                <Stack gap="md">
                    {resources.map((resource, index) => (
                        <Group key={resource.id} align="flex-start" wrap="nowrap">
                            <UpdateQuizResourceForm
                                moduleId={moduleId}
                                resource={resource}
                                resourceIndex={index}
                                availablePages={pages.map((p) => ({ id: p.id, title: p.title }))}
                                nestedQuizId={nestedQuizId}
                            />
                        </Group>
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
