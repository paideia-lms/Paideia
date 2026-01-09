import { Button, Paper, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useToggleQuizType,
} from "app/routes/user/module/edit-setting/route";

interface ToggleQuizTypeFormProps {
    moduleId: number;
    currentType: "regular" | "container";
}

export function ToggleQuizTypeForm({
    moduleId,
    currentType,
}: ToggleQuizTypeFormProps) {
    const { submit: toggleQuizType, isLoading } = useToggleQuizType();

    const form = useForm({
        initialValues: {
            newType: currentType,
        },
    });

    return (
        <Paper withBorder p="md" radius="md">
            <form
                onSubmit={form.onSubmit((values) => {
                    toggleQuizType({
                        params: { moduleId },
                        values: { newType: values.newType },
                    });
                })}
            >
                <Stack gap="md">
                    <Title order={4}>Quiz Type</Title>
                    <Select
                        {...form.getInputProps("newType")}
                        label="Quiz Type"
                        description="Choose between a regular quiz or a container quiz with multiple quizzes"
                        data={[
                            { value: "regular", label: "Regular Quiz" },
                            { value: "container", label: "Container Quiz (Multiple Quizzes)" },
                        ]}
                    />
                    <Button type="submit" loading={isLoading}>
                        Save Quiz Type
                    </Button>
                </Stack>
            </form>
        </Paper>
    );
}
