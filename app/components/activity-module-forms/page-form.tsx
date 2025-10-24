import { Stack, Textarea, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useState } from "react";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { RichTextEditor } from "../rich-text-editor";
import { CommonFields } from "./common-fields";

interface PageFormProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
}

export function PageForm({ form }: PageFormProps) {
    const [htmlContent, setHtmlContent] = useState(form.getValues().pageContent);

    return (
        <Stack gap="md">
            <CommonFields form={form} />

            <Textarea
                {...form.getInputProps("description")}
                key={form.key("description")}
                label="Description"
                placeholder="Enter module description"
                minRows={3}
            />

            <div>
                <Title order={5} mb="xs">
                    Page Content
                </Title>
                <RichTextEditor
                    content={htmlContent}
                    placeholder="Enter page content..."
                    onChange={(html) => {
                        setHtmlContent(html);
                        form.setFieldValue("pageContent", html);
                    }}
                />
            </div>
        </Stack>
    );
}