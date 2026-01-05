import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
    AppState,
    BinaryFiles,
    ExcalidrawImperativeAPI,
    ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import {
    ActionIcon,
    Box,
    Loader,
    Tooltip,
    useMantineColorScheme,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import {
    useDebouncedCallback,
    useFullscreen,
    useMounted,
} from "@mantine/hooks";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import type { FormPathValue } from "~/packages/@mantine/form/lib/paths.types";
import { Input } from "@mantine/core";
import { useWhiteboardData } from "../activity-module-forms/use-whiteboard-data";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = lazy(() =>
    import("@excalidraw/excalidraw").then((module) => ({
        default: module.Excalidraw,
    })),
);

interface FormableWhiteboardProps<T> {
    form: UseFormReturnType<T>;
    formKey: string;
    label: string;
}

/**
 * This component is a wrapper around the Excalidraw whiteboard component that is used to edit the content of a form.
 *
 * @usage
 *
 * ```
 * <FormableWhiteboard form={form} formKey={form.key("whiteboardContent")} key={form.key("whiteboardContent")} label="Whiteboard Canvas" />
 * ```
 */
export function FormableWhiteboard<T>({
    form,
    formKey,
    label,
}: FormableWhiteboardProps<T>) {
    const whiteboardContent = useFormWatchForceUpdate(form, formKey);
    const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const { colorScheme } = useMantineColorScheme();
    const { ref: fullscreenRef, toggle, fullscreen } = useFullscreen();
    const mounted = useMounted();

    // only calculate when first rendered
    const initialData = useWhiteboardData(whiteboardContent as string);

    // Sync theme with Mantine's color scheme
    useLayoutEffect(() => {
        if (excalidrawRef.current) {
            const theme = colorScheme === "dark" ? "dark" : "light";
            excalidrawRef.current.updateScene({ appState: { theme } });
        }
    }, [colorScheme]);

    // Create a debounced callback to save the whiteboard state
    const saveSnapshot = useDebouncedCallback(
        (
            elements: readonly OrderedExcalidrawElement[],
            _appState: AppState,
            files: BinaryFiles,
        ) => {
            const data: ExcalidrawInitialDataState = {
                elements,
                appState: {
                    collaborators: new Map(),
                },
                files,
            };
            form.setFieldValue(
                formKey,
                JSON.stringify(data) as FormPathValue<T, string>,
            );
        },
        200,
    );

    return (
        <Input.Wrapper label={label}>
            <Box
                ref={fullscreenRef}
                style={{ height: "500px", border: "1px solid #dee2e6" }}
            >
                {!mounted ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                        }}
                    >
                        <Loader />
                    </div>
                ) : (
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
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
                            theme={colorScheme === "dark" ? "dark" : "light"}
                            renderTopRightUI={() => (
                                <Tooltip
                                    label={
                                        fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"
                                    }
                                >
                                    <ActionIcon
                                        onClick={toggle}
                                        variant="default"
                                        size="lg"
                                        aria-label={
                                            fullscreen ? "Exit fullscreen" : "Enter fullscreen"
                                        }
                                    >
                                        {fullscreen ? (
                                            <IconMinimize size={18} />
                                        ) : (
                                            <IconMaximize size={18} />
                                        )}
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        />
                    </Suspense>
                )}
            </Box>
        </Input.Wrapper>
    );
}

