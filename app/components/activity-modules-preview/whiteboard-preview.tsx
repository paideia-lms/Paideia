import { Paper } from "@mantine/core";
import { Tldraw, createTLStore, loadSnapshot } from "tldraw";
import { useLayoutEffect, useMemo } from "react";
import "tldraw/tldraw.css";
import type { TLEditorSnapshot } from "tldraw";

interface WhiteboardPreviewProps {
    content: string;
}

export function WhiteboardPreview({ content }: WhiteboardPreviewProps) {
    const store = useMemo(() => createTLStore(), []);

    useLayoutEffect(() => {
        if (content) {
            try {
                const snapshot = JSON.parse(content) as TLEditorSnapshot;
                loadSnapshot(store, snapshot);
            } catch (error) {
                console.error("Failed to load whiteboard content:", error);
            }
        }
    }, [content, store]);

    return (
        <Paper withBorder radius="md" style={{ height: "600px", overflow: "hidden" }}>
            <Tldraw
                store={store}
                onMount={(editor) => {
                    // Make the editor read-only
                    editor.updateInstanceState({ isReadonly: true });
                }}
            />
        </Paper>
    );
}

