import { Button } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMarkNestedQuizAsComplete, type Route } from "../../route";
import { createRouteComponent } from "~/utils/create-route-component";
interface MarkNestedQuizCompleteButtonProps {
    submissionId: number;
    nestedQuizId: string;
    disabled?: boolean;
    fullWidth?: boolean;
    variant?: "filled" | "light" | "outline" | "default" | "subtle" | "gradient";
    size?: string;
    moduleLinkId: number;
}

export const MarkNestedQuizCompleteButton = createRouteComponent<Route.ComponentProps, MarkNestedQuizCompleteButtonProps>(
    (props, { loaderData }) => {
        const { submissionId, nestedQuizId, disabled = false, fullWidth = false, variant = "filled", size } = props;
        const { moduleLinkId } = loaderData;
        const { submit: markNestedQuizAsComplete, isLoading } =
            useMarkNestedQuizAsComplete();
        return (
            <Button
                leftSection={<IconCheck size={16} />}
                onClick={async () => {

                    await markNestedQuizAsComplete({
                        values: {
                            submissionId,
                            nestedQuizId,
                        },
                        params: {
                            moduleLinkId
                        }
                    });
                }}
                loading={isLoading}
                disabled={disabled}
                fullWidth={fullWidth}
                variant={variant}
                size={size}
            >
                Mark as Complete
            </Button>
        );
    });
