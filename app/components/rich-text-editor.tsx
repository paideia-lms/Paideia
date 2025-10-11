import {
    getTaskListExtension,
    Link,
    RichTextEditor as MantineRTE,
    useRichTextEditorContext,
} from "@mantine/tiptap";
import { useFileDialog } from "@mantine/hooks";
import {
    IconBrandYoutube,
    IconColumnInsertLeft,
    IconColumnInsertRight,
    IconColumnRemove,
    IconColumns3,
    IconContainer,
    IconLayoutNavbar,
    IconLayoutSidebar,
    IconPhoto,
    IconRowInsertBottom,
    IconRowInsertTop,
    IconRowRemove,
    IconTable,
    IconTableOff,
} from "@tabler/icons-react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Color } from "@tiptap/extension-color";
import Dropcursor from "@tiptap/extension-dropcursor";
import FileHandler from "@tiptap/extension-file-handler";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import SubScript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TipTapTaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { type Editor, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import js from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import ts from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";
import { useEffect, useState } from "react";

const lowlight = createLowlight();

// Register common programming languages
lowlight.register("typescript", ts);
lowlight.register("javascript", js);
lowlight.register("python", python);
lowlight.register("java", java);
lowlight.register("css", css);
lowlight.register("html", html);
lowlight.register("json", json);
lowlight.register("bash", bash);
lowlight.register("sql", sql);
lowlight.register("markdown", markdown);

// Custom hook for image resizing
function useImageResize(editor: Editor | null) {
    useEffect(() => {
        if (!editor) return;

        const editorElement = editor.view.dom;
        let resizingImg: HTMLImageElement | null = null;
        let startX = 0;
        let startWidth = 0;
        let startHeight = 0;

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'IMG' && target.classList.contains('ProseMirror-selectednode')) {
                event.preventDefault();
                resizingImg = target as HTMLImageElement;
                startX = event.clientX;
                startWidth = resizingImg.offsetWidth;
                startHeight = resizingImg.offsetHeight;

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (!resizingImg) return;

            const deltaX = event.clientX - startX;
            const newWidth = startWidth + deltaX;

            // Maintain aspect ratio
            const aspectRatio = startHeight / startWidth;
            const newHeight = newWidth * aspectRatio;

            resizingImg.style.width = `${newWidth}px`;
            resizingImg.style.height = `${newHeight}px`;
        };

        const handleMouseUp = () => {
            if (!resizingImg) return;

            // Only update if the size actually changed (not just a click)
            const currentWidth = resizingImg.offsetWidth;
            const sizeChanged = Math.abs(currentWidth - startWidth) > 2; // 2px threshold

            if (sizeChanged) {
                // Update the node attributes in Tiptap
                const { state } = editor.view;
                const pos = editor.view.posAtDOM(resizingImg, 0);

                if (pos !== null && pos !== undefined) {
                    const resolvedPos = state.doc.resolve(pos);
                    const node = resolvedPos.parent.maybeChild(resolvedPos.index());

                    if (node && node.type.name === 'image') {
                        editor.commands.updateAttributes('image', {
                            width: resizingImg.style.width,
                            height: resizingImg.style.height,
                        });
                    }
                }
            }

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            resizingImg = null;
        };

        editorElement.addEventListener('mousedown', handleMouseDown);

        return () => {
            editorElement.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [editor]);
}

// Table Controls
function InsertTableControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() =>
                editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
            }
            aria-label="Insert table"
            title="Insert table"
        >
            <IconTable stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddColumnBeforeControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().addColumnBefore().run()}
            aria-label="Add column before"
            title="Add column before"
        >
            <IconColumnInsertLeft stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddColumnAfterControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
            aria-label="Add column after"
            title="Add column after"
        >
            <IconColumnInsertRight stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function DeleteColumnControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().deleteColumn().run()}
            aria-label="Delete column"
            title="Delete column"
        >
            <IconColumnRemove stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddRowBeforeControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().addRowBefore().run()}
            aria-label="Add row before"
            title="Add row before"
        >
            <IconRowInsertTop stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddRowAfterControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().addRowAfter().run()}
            aria-label="Add row after"
            title="Add row after"
        >
            <IconRowInsertBottom stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function DeleteRowControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().deleteRow().run()}
            aria-label="Delete row"
            title="Delete row"
        >
            <IconRowRemove stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function DeleteTableControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().deleteTable().run()}
            aria-label="Delete table"
            title="Delete table"
        >
            <IconTableOff stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function MergeCellsControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().mergeCells().run()}
            aria-label="Merge cells"
            title="Merge cells"
        >
            <IconContainer stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function SplitCellControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().splitCell().run()}
            aria-label="Split cell"
            title="Split cell"
        >
            <IconColumns3 stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function ToggleHeaderColumnControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}
            aria-label="Toggle header column"
            title="Toggle header column"
        >
            <IconLayoutSidebar stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function ToggleHeaderRowControl() {
    const { editor } = useRichTextEditorContext();
    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
            aria-label="Toggle header row"
            title="Toggle header row"
        >
            <IconLayoutNavbar stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddYoutubeVideoControl() {
    const { editor } = useRichTextEditorContext();

    const addYoutubeVideo = () => {
        const url = prompt("Enter YouTube URL");

        if (url) {
            editor?.commands.setYoutubeVideo({
                src: url,
                width: 640,
                height: 480,
            });
        }
    };

    return (
        <MantineRTE.Control
            onClick={addYoutubeVideo}
            aria-label="Add YouTube video"
            title="Add YouTube video"
        >
            <IconBrandYoutube stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function AddImageControl({ onImageAdd }: { onImageAdd?: (imageFile: ImageFile) => void }) {
    const { editor } = useRichTextEditorContext();
    const fileDialog = useFileDialog({
        accept: 'image/jpeg,image/png,image/gif,image/webp',
        multiple: false,
    });

    // Handle file selection when files change
    useEffect(() => {
        if (fileDialog.files && fileDialog.files.length > 0) {
            const file = fileDialog.files[0];
            const reader = new FileReader();

            reader.onload = () => {
                const id = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                const preview = reader.result as string;

                if (onImageAdd) {
                    onImageAdd({ id, file, preview });
                }

                editor?.chain().focus().setImage({ src: preview }).run();
            };

            reader.readAsDataURL(file);
            fileDialog.reset();
        }
    }, [fileDialog.files, editor, onImageAdd, fileDialog]);

    return (
        <MantineRTE.Control
            onClick={fileDialog.open}
            aria-label="Add image"
            title="Add image"
        >
            <IconPhoto stroke={1.5} size={16} />
        </MantineRTE.Control>
    );
}

function ImageSizeSmallControl() {
    const { editor } = useRichTextEditorContext();

    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().updateAttributes('image', {
                width: '300px',
                height: null
            }).run()}
            aria-label="Small image"
            title="Small image (300px)"
        >
            <span style={{ fontSize: '10px' }}>S</span>
        </MantineRTE.Control>
    );
}

function ImageSizeMediumControl() {
    const { editor } = useRichTextEditorContext();

    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().updateAttributes('image', {
                width: '500px',
                height: null
            }).run()}
            aria-label="Medium image"
            title="Medium image (500px)"
        >
            <span style={{ fontSize: '12px' }}>M</span>
        </MantineRTE.Control>
    );
}

function ImageSizeLargeControl() {
    const { editor } = useRichTextEditorContext();

    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().updateAttributes('image', {
                width: '800px',
                height: null
            }).run()}
            aria-label="Large image"
            title="Large image (800px)"
        >
            <span style={{ fontSize: '14px' }}>L</span>
        </MantineRTE.Control>
    );
}

function ImageSizeFullControl() {
    const { editor } = useRichTextEditorContext();

    return (
        <MantineRTE.Control
            onClick={() => editor?.chain().focus().updateAttributes('image', {
                width: '100%',
                height: null
            }).run()}
            aria-label="Full width image"
            title="Full width image"
        >
            <span style={{ fontSize: '10px' }}>100%</span>
        </MantineRTE.Control>
    );
}

export interface ImageFile {
    id: string;
    file: File;
    preview: string;
}

interface RichTextEditorProps {
    content?: string;
    placeholder?: string;
    onChange?: (content: string) => void;
    onEditorReady?: (editor: Editor) => void;
    onImageAdd?: (imageFile: ImageFile) => void;
}

export function RichTextEditor({
    content = "",
    placeholder = "Start typing...",
    onChange,
    onEditorReady,
    onImageAdd,
}: RichTextEditorProps) {
    const [isSourceCodeMode, setIsSourceCodeMode] = useState(false);

    const editor = useEditor({
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        extensions: [
            StarterKit.configure({ link: false, codeBlock: false }),
            Link,
            Highlight,
            Superscript,
            SubScript,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Placeholder.configure({ placeholder }),
            CodeBlockLowlight.configure({ lowlight }),
            getTaskListExtension(TipTapTaskList),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: "task-item",
                },
            }),
            Gapcursor,
            TableKit.configure({
                table: {
                    resizable: true,
                },
            }),
            TextStyle,
            Color,
            Youtube.configure({
                controls: false,
                nocookie: true,
            }),
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        width: {
                            default: null,
                            renderHTML: (attributes) => {
                                if (!attributes.width) {
                                    return {};
                                }
                                return { width: attributes.width };
                            },
                        },
                        height: {
                            default: null,
                            renderHTML: (attributes) => {
                                if (!attributes.height) {
                                    return {};
                                }
                                return { height: attributes.height };
                            },
                        },
                    };
                },
            }).configure({
                inline: false,
                allowBase64: true,
            }),
            Dropcursor,
            FileHandler.configure({
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                onDrop: (editor, files) => {
                    files.forEach(async (file) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const id = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                            const preview = reader.result as string;

                            if (onImageAdd) {
                                onImageAdd({ id, file, preview });
                            }

                            editor.chain().focus().setImage({ src: preview }).run();
                        };
                        reader.readAsDataURL(file);
                    });
                },
                onPaste: (editor, files) => {
                    files.forEach(async (file) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const id = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                            const preview = reader.result as string;

                            if (onImageAdd) {
                                onImageAdd({ id, file, preview });
                            }

                            editor.chain().focus().setImage({ src: preview }).run();
                        };
                        reader.readAsDataURL(file);
                    });
                },
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
        },
        onCreate: ({ editor }) => {
            if (onEditorReady) {
                onEditorReady(editor);
            }
        },
    });

    // Add image resizing functionality
    useImageResize(editor);

    return (
        <MantineRTE editor={editor} onSourceCodeTextSwitch={setIsSourceCodeMode}>
            {editor && (
                <BubbleMenu editor={editor} options={{
                    placement: "bottom-start",
                }} >
                    <MantineRTE.ControlsGroup>
                        <MantineRTE.Bold />
                        <MantineRTE.Italic />
                        <MantineRTE.Underline />
                        <MantineRTE.Strikethrough />
                        <MantineRTE.Highlight />
                        <MantineRTE.ColorPicker
                            colors={[
                                "#25262b",
                                "#868e96",
                                "#fa5252",
                                "#e64980",
                                "#be4bdb",
                                "#7950f2",
                                "#4c6ef5",
                                "#228be6",
                                "#15aabf",
                                "#12b886",
                                "#40c057",
                                "#82c91e",
                                "#fab005",
                                "#fd7e14",
                            ]}
                        />
                        <MantineRTE.UnsetColor />
                    </MantineRTE.ControlsGroup>
                </BubbleMenu>
            )}

            <MantineRTE.Toolbar sticky stickyOffset="var(--docs-header-height)">
                <MantineRTE.ControlsGroup>
                    <MantineRTE.SourceCode />
                </MantineRTE.ControlsGroup>

                {!isSourceCodeMode && (
                    <>
                        <MantineRTE.ControlsGroup>
                            <MantineRTE.Bold />
                            <MantineRTE.Italic />
                            <MantineRTE.Underline />
                            <MantineRTE.Strikethrough />
                            <MantineRTE.ClearFormatting />
                            <MantineRTE.Highlight />
                            <MantineRTE.Code />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ColorPicker
                            colors={[
                                "#25262b",
                                "#868e96",
                                "#fa5252",
                                "#e64980",
                                "#be4bdb",
                                "#7950f2",
                                "#4c6ef5",
                                "#228be6",
                                "#15aabf",
                                "#12b886",
                                "#40c057",
                                "#82c91e",
                                "#fab005",
                                "#fd7e14",
                            ]}
                        />


                        <MantineRTE.ControlsGroup>
                            <MantineRTE.UnsetColor />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.H1 />
                            <MantineRTE.H2 />
                            <MantineRTE.H3 />
                            <MantineRTE.H4 />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.Blockquote />
                            <MantineRTE.Hr />
                            <MantineRTE.BulletList />
                            <MantineRTE.OrderedList />
                            <MantineRTE.Subscript />
                            <MantineRTE.Superscript />
                            <MantineRTE.CodeBlock />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.TaskList />
                            <MantineRTE.TaskListLift />
                            <MantineRTE.TaskListSink />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <InsertTableControl />
                            <AddColumnBeforeControl />
                            <AddColumnAfterControl />
                            <DeleteColumnControl />
                            <AddRowBeforeControl />
                            <AddRowAfterControl />
                            <DeleteRowControl />
                            <DeleteTableControl />
                            <MergeCellsControl />
                            <SplitCellControl />
                            <ToggleHeaderColumnControl />
                            <ToggleHeaderRowControl />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.Link />
                            <MantineRTE.Unlink />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <AddImageControl onImageAdd={onImageAdd} />
                            <AddYoutubeVideoControl />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <ImageSizeSmallControl />
                            <ImageSizeMediumControl />
                            <ImageSizeLargeControl />
                            <ImageSizeFullControl />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.AlignLeft />
                            <MantineRTE.AlignCenter />
                            <MantineRTE.AlignJustify />
                            <MantineRTE.AlignRight />
                        </MantineRTE.ControlsGroup>

                        <MantineRTE.ControlsGroup>
                            <MantineRTE.Undo />
                            <MantineRTE.Redo />
                        </MantineRTE.ControlsGroup>
                    </>
                )}
            </MantineRTE.Toolbar>

            <MantineRTE.Content />
        </MantineRTE>
    );
}
