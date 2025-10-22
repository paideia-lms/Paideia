import type {
    ExcalidrawImperativeAPI,
    ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import {
    Box,
    Loader,
    Stack,
    Title,
    useMantineColorScheme,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { CommonFields } from './common-fields';
import type { FormApi } from './use-form-context';

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
    import('@excalidraw/excalidraw').then((module) => ({
        default: module.Excalidraw,
    })),
);

type WhiteboardFormProps = {
    form: FormApi;
    isLoading?: boolean;
};

/**
 * Whiteboard module form using Tanstack Form
 * Includes common fields, description, and Excalidraw canvas
 */
export function WhiteboardForm({ form, isLoading = false }: WhiteboardFormProps) {
    const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const { colorScheme } = useMantineColorScheme();
    const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(null);
    const [isClient, setIsClient] = useState(false);

    // Ensure we're on the client side
    useLayoutEffect(() => {
        setIsClient(true);
    }, []);

    // Load initial data from form
    useLayoutEffect(() => {
        const existingContent = form.state.values.whiteboardContent;

        if (existingContent && existingContent.trim().length > 0) {
            try {
                const data = JSON.parse(existingContent) as ExcalidrawInitialDataState;
                // Ensure appState has the required structure
                setInitialData({
                    ...data,
                    appState: {
                        ...data.appState,
                        collaborators: new Map(),
                    },
                });
            } catch (error: unknown) {
                console.error('Failed to load whiteboard data:', error);
                setInitialData({
                    appState: {
                        collaborators: new Map(),
                    },
                });
            }
        } else {
            setInitialData({
                appState: {
                    collaborators: new Map(),
                },
            });
        }
    }, [form.state.values.whiteboardContent]);

    // Sync theme with Mantine's color scheme
    useLayoutEffect(() => {
        if (excalidrawRef.current) {
            const theme = colorScheme === 'dark' ? 'dark' : 'light';
            excalidrawRef.current.updateScene({ appState: { theme } });
        }
    }, [colorScheme]);

    // Create a debounced callback to save the whiteboard state
    const saveSnapshot = useDebouncedCallback((elements, appState, files) => {
        const data: ExcalidrawInitialDataState = {
            elements,
            appState,
            files,
        };
        // Get the field API to update the value
        form.setFieldValue('whiteboardContent', JSON.stringify(data));
    }, 500);

    return (
        <Stack gap="md">
            <CommonFields form={form} />

            {/* Description Field */}
            <form.AppField name="description">
                {(field) => (
                    <field.TextareaField
                        label="Description"
                        placeholder="Enter module description"
                        minRows={3}
                    />
                )}
            </form.AppField>

            <div>
                <Title order={5} mb="xs">
                    Whiteboard Canvas
                </Title>
                <Box style={{ height: '500px', border: '1px solid #dee2e6' }}>
                    {isLoading || initialData === null || !isClient ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                            }}
                        >
                            <Loader />
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                    }}
                                >
                                    <Loader />
                                </div>
                            }
                        >
                            <Excalidraw
                                excalidrawAPI={(api) => {
                                    excalidrawRef.current = api;
                                }}
                                initialData={initialData}
                                onChange={(elements, appState, files) => {
                                    saveSnapshot(elements, appState, files);
                                }}
                                theme={colorScheme === 'dark' ? 'dark' : 'light'}
                            />
                        </Suspense>
                    )}
                </Box>
            </div>
        </Stack>
    );
}

