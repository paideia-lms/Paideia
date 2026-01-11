import { Button } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useStartNestedQuiz } from "../../route";

interface StartNestedQuizButtonProps {
    submissionId: number;
    nestedQuizId: string;
    onStart?: () => void;
    disabled?: boolean;
    fullWidth?: boolean;
    moduleLinkId: number;
    variant?: "filled" | "light" | "outline" | "default" | "subtle" | "gradient";
    size?: string;
}

export function StartNestedQuizButton({
    submissionId,
    nestedQuizId,
    onStart,
    disabled = false,
    fullWidth = false,
    moduleLinkId,
    variant = "filled",
    size,
}: StartNestedQuizButtonProps) {
    const { submit: startNestedQuiz, isLoading } = useStartNestedQuiz();

    const handleStart = () => {
        startNestedQuiz({
            values: {
                submissionId,
                nestedQuizId,
            },
            params: {
                moduleLinkId,
            },
        });
        if (onStart) {
            onStart();
        }
    };

    return (
        <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={handleStart}
            loading={isLoading}
            disabled={disabled || isLoading}
            fullWidth={fullWidth}
            variant={variant}
            size={size}
        >
            Start Quiz
        </Button>
    );
}
