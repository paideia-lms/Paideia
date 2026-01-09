import { Button, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useUpdatePageInfo,
} from "app/routes/user/module/edit-setting/route";
import type { QuizPage } from "./types";

interface UpdatePageInfoFormProps {
    moduleId: number;
    page: QuizPage;
    nestedQuizId?: string;
}

export function UpdatePageInfoForm({
    moduleId,
    page,
    nestedQuizId,
}: UpdatePageInfoFormProps) {
    const { submit: updatePageInfo, isLoading } = useUpdatePageInfo();

    const form = useForm({
        initialValues: {
            title: page.title,
        },
    });

    return (
        <form
                onSubmit={form.onSubmit((values) => {
                    updatePageInfo({
                        params: { moduleId },
                        values: {
                            pageId: page.id,
                            updates: { title: values.title },
                            nestedQuizId,
                        },
                    });
                })}
            >
                <Stack gap="md">
                    <TextInput
                        {...form.getInputProps("title")}
                        label="Page Title"
                        required
                    />
                    <Button type="submit" loading={isLoading}>
                        Save Page Title
                    </Button>
                </Stack>
            </form>
    );
}
