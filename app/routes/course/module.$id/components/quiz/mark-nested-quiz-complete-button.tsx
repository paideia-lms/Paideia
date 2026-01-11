import { Button } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMarkNestedQuizAsComplete } from "../../route";

interface MarkNestedQuizCompleteButtonProps {
    submissionId: number;
    nestedQuizId: string;
    bypassTimeLimit?: boolean;
    onComplete?: () => void;
    disabled?: boolean;
    fullWidth?: boolean;
    variant?: "filled" | "light" | "outline" | "default" | "subtle" | "gradient";
    size?: string;
    children?: React.ReactNode;
    moduleLinkId: number;
}

export function MarkNestedQuizCompleteButton({
    submissionId,
    nestedQuizId,
    bypassTimeLimit = false,
    onComplete,
    disabled = false,
    fullWidth = false,
    variant = "filled",
    size,
    children,
    moduleLinkId,
}: MarkNestedQuizCompleteButtonProps) {
    const { submit: markNestedQuizAsComplete, isLoading } =
        useMarkNestedQuizAsComplete();

    const handleComplete = async () => {
        await markNestedQuizAsComplete({
            values: {
                submissionId,
                nestedQuizId,
            },
            params: {
                moduleLinkId
            }
        });
        if (onComplete) {
            onComplete();
        }
    };

    return (
        <Button
            leftSection={<IconCheck size={16} />}
            onClick={handleComplete}
            loading={isLoading}
            disabled={disabled || isLoading}
            fullWidth={fullWidth}
            variant={variant}
            size={size}
        >
            {children ?? "Mark as Complete"}
        </Button>
    );
}
