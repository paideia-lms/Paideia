import { Box, Stack, Textarea, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useDebouncedCallback } from "@mantine/hooks";
import { useLayoutEffect, useMemo } from "react";
import {
    createTLStore,
    DefaultSpinner,
    getSnapshot,
    loadSnapshot,
    type TLEditorSnapshot,
    Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { CommonFields } from "./common-fields";

interface WhiteboardFormProps {
    form: UseFormReturnType<ActivityModuleFormValues>;
    isLoading?: boolean;
}

export function WhiteboardForm({ form, isLoading = false }: WhiteboardFormProps) {
    // Create a store instance
    const store = useMemo(() => createTLStore(), []);

    // Create a debounced callback to save the whiteboard snapshot
    const saveSnapshot = useDebouncedCallback(() => {
        const snapshot = getSnapshot(store);
        form.setFieldValue("whiteboardContent", JSON.stringify(snapshot));
    }, 200);

    useLayoutEffect(() => {
        // Get persisted data from form whiteboardContent field
        const existingContent = form.getValues().whiteboardContent;

        if (existingContent && existingContent.trim().length > 0) {
            try {
                const snapshot = JSON.parse(
                    existingContent,
                ) as Partial<TLEditorSnapshot>;
                loadSnapshot(store, snapshot);
            } catch (error: unknown) {
                console.error("Failed to load whiteboard data:", error);
                // Continue with empty store on error
            }
        }

        // Each time the store changes, save to form (with debouncing)
        const cleanupFn = store.listen(() => {
            saveSnapshot();
        });

        return () => {
            cleanupFn();
        };
    }, [store, form, saveSnapshot]);

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
                    Whiteboard Canvas
                </Title>
                <Box style={{ height: "500px", border: "1px solid #dee2e6" }}>
                    {isLoading ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                            }}
                        >
                            <DefaultSpinner />
                        </div>
                    ) : (
                        <Tldraw store={store} />
                    )}
                </Box>
            </div>
        </Stack>
    );
}
