import { Button } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import {
    useRemoveQuestion,
} from "app/routes/user/module/edit-setting/route";

interface RemoveQuestionButtonProps {
    moduleId: number;
    questionId: string;
    nestedQuizId?: string;
}

export function RemoveQuestionButton({
    moduleId,
    questionId,
    nestedQuizId,
}: RemoveQuestionButtonProps) {
    const { submit: removeQuestion, isLoading } = useRemoveQuestion();

    return (
        <Button
            color="red"
            variant="subtle"
            leftSection={<IconTrash size={16} />}
            onClick={() => {
                removeQuestion({
                    params: { moduleId },
                    values: {
                        questionId,
                        nestedQuizId,
                    },
                });
            }}
            loading={isLoading}
        >
            Remove
        </Button>
    );
}
