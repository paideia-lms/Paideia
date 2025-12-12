import { useMantineColorScheme } from "@mantine/core";
import { useDebouncedCallback, useFileDialog } from "@mantine/hooks";
import {
	getTaskListExtension,
	Link,
	RichTextEditor as MantineRTE,
	useRichTextEditorContext,
} from "@mantine/tiptap";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconBrandYoutube,
	IconBulb,
	IconChevronRight,
	IconCode,
	IconColumnInsertLeft,
	IconColumnInsertRight,
	IconColumnRemove,
	IconColumns3,
	IconContainer,
	IconExclamationCircle,
	IconInfoCircle,
	IconLayoutNavbar,
	IconLayoutSidebar,
	IconPhoto,
	IconRowInsertBottom,
	IconRowInsertTop,
	IconRowRemove,
	IconTable,
	IconTableOff,
} from "@tabler/icons-react";
import type { Editor, EditorEvents } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Color } from "@tiptap/extension-color";
import {
	Details,
	DetailsContent,
	DetailsSummary,
} from "@tiptap/extension-details";
import Dropcursor from "@tiptap/extension-dropcursor";
import FileHandler from "@tiptap/extension-file-handler";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import SubScript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TipTapTaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import {
	NodeViewContent,
	NodeViewWrapper,
	ReactNodeViewRenderer,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { encode } from "entities";
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
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { mermaidGrammar } from "lowlight-mermaid";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import rehypeFormat from "rehype-format";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { getTextContentFromHtmlServer } from "~/utils/html-utils";
import { createMentionSuggestion } from "./mention-suggestion";

export function getTextContentFromHtmlClient(html: string): string {
	if (getTextContentFromHtmlServer) {
		return getTextContentFromHtmlServer(html);
	}

	// use DOM parser
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	const text = doc.body.textContent || "";
	return text.trim().replace(/\s+/g, " ");
}

/**
 * Calculate character count from text
 */
export function getCharacterCount(text: string): number {
	return text.length;
}

/**
 * Calculate word count from text
 */
export function getWordCount(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
}

/**
 * Check if text content is empty (after trimming)
 */
export function isTextEmpty(text: string): boolean {
	return text.trim().length === 0;
}

/**
 * Check if HTML content is empty (after extracting text and trimming)
 */
export function isHtmlEmpty(html: string): boolean {
	const textContent = getTextContentFromHtmlClient(html);
	return isTextEmpty(textContent);
}

/**
 * Get text statistics for a given text
 */
export function getTextStats(text: string) {
	return {
		characterCount: getCharacterCount(text),
		wordCount: getWordCount(text),
		isEmpty: isTextEmpty(text),
	};
}

/**
 * Get text statistics from HTML content
 */
export function getTextStatsFromHtml(html: string) {
	const textContent = getTextContentFromHtmlClient(html);
	return getTextStats(textContent);
}

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
lowlight.register("yaml", yaml);
lowlight.register("markdown", markdown);
lowlight.register("mermaid", mermaidGrammar);
// D2 doesn't have a lowlight grammar, so we register it as plaintext
lowlight.register("d2", () => ({ name: "d2", contains: [] }));

// Custom Code Block Component with language selector
function CodeBlockComponent({
	node,
	updateAttributes,
	extension,
	editor,
}: {
	node: {
		attrs: {
			language: string;
		};
	};
	updateAttributes: (attrs: { language: string }) => void;
	extension: {
		options: {
			lowlight: typeof lowlight;
		};
	};
	editor: Editor;
}) {
	const isEditable = editor.isEditable;

	return (
		<NodeViewWrapper className="code-block">
			{isEditable && (
				<select
					contentEditable={false}
					defaultValue={node.attrs.language}
					onChange={(event) =>
						updateAttributes({ language: event.target.value })
					}
				>
					<option value="null">auto</option>
					<option disabled>—</option>
					{extension.options.lowlight.listLanguages().map((lang) => (
						<option key={lang} value={lang}>
							{lang}
						</option>
					))}
				</select>
			)}
			<pre>
				<code>
					<NodeViewContent />
				</code>
			</pre>
		</NodeViewWrapper>
	);
}

// Custom Blockquote extension with callout support
const CalloutBlockquote = Blockquote.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			type: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-type"),
				renderHTML: (attributes) => {
					if (!attributes.type) {
						return {};
					}
					return {
						"data-type": attributes.type,
						class: `callout callout-${attributes.type}`,
					};
				},
			},
		};
	},
});

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
			if (
				target.tagName === "IMG" &&
				target.classList.contains("ProseMirror-selectednode")
			) {
				event.preventDefault();
				resizingImg = target as HTMLImageElement;
				startX = event.clientX;
				startWidth = resizingImg.offsetWidth;
				startHeight = resizingImg.offsetHeight;

				document.addEventListener("mousemove", handleMouseMove);
				document.addEventListener("mouseup", handleMouseUp);
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

					if (node && node.type.name === "image") {
						editor.commands.updateAttributes("image", {
							width: resizingImg.style.width,
							height: resizingImg.style.height,
						});
					}
				}
			}

			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			resizingImg = null;
		};

		editorElement.addEventListener("mousedown", handleMouseDown);

		return () => {
			editorElement.removeEventListener("mousedown", handleMouseDown);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
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

// Callout Controls
function CalloutNoteControl() {
	const { editor } = useRichTextEditorContext();
	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.toggleBlockquote()
					.updateAttributes("blockquote", { type: "note" })
					.run()
			}
			aria-label="Note callout"
			title="Note callout"
			active={editor?.isActive("blockquote", { type: "note" })}
		>
			<IconInfoCircle stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

function CalloutTipControl() {
	const { editor } = useRichTextEditorContext() as { editor: Editor | null };
	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.toggleBlockquote()
					.updateAttributes("blockquote", { type: "tip" })
					.run()
			}
			aria-label="Tip callout"
			title="Tip callout"
			active={editor?.isActive("blockquote", { type: "tip" })}
		>
			<IconBulb stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

function CalloutImportantControl() {
	const { editor } = useRichTextEditorContext() as { editor: Editor | null };
	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.toggleBlockquote()
					.updateAttributes("blockquote", { type: "important" })
					.run()
			}
			aria-label="Important callout"
			title="Important callout"
			active={editor?.isActive("blockquote", { type: "important" })}
		>
			<IconExclamationCircle stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

function CalloutWarningControl() {
	const { editor } = useRichTextEditorContext() as { editor: Editor | null };
	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.toggleBlockquote()
					.updateAttributes("blockquote", { type: "warning" })
					.run()
			}
			aria-label="Warning callout"
			title="Warning callout"
			active={editor?.isActive("blockquote", { type: "warning" })}
		>
			<IconAlertTriangle stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

function CalloutCautionControl() {
	const { editor } = useRichTextEditorContext() as { editor: Editor | null };
	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.toggleBlockquote()
					.updateAttributes("blockquote", { type: "caution" })
					.run()
			}
			aria-label="Caution callout"
			title="Caution callout"
			active={editor?.isActive("blockquote", { type: "caution" })}
		>
			<IconAlertCircle stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

// Details Control
function DetailsControl() {
	const { editor } = useRichTextEditorContext() as { editor: Editor | null };
	return (
		<MantineRTE.Control
			onClick={() => editor?.chain().focus().setDetails().run()}
			aria-label="Insert collapsible details"
			title="Insert collapsible details"
			active={editor?.isActive("details")}
			disabled={!editor?.can().setDetails()}
		>
			<IconChevronRight stroke={1.5} size={16} />
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

function AddImageControl({
	onImageAdd,
}: {
	onImageAdd?: (imageFile: ImageFile) => void;
}) {
	const { editor } = useRichTextEditorContext();
	const fileDialog = useFileDialog({
		accept: "image/jpeg,image/png,image/gif,image/webp",
		multiple: false,
	});

	// Handle file selection when files change
	useEffect(() => {
		if (fileDialog.files && fileDialog.files.length > 0) {
			const file = fileDialog.files[0]!;
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
			onClick={() =>
				editor
					?.chain()
					.focus()
					.updateAttributes("image", {
						width: "300px",
						height: null,
					})
					.run()
			}
			aria-label="Small image"
			title="Small image (300px)"
		>
			<span style={{ fontSize: "10px" }}>S</span>
		</MantineRTE.Control>
	);
}

function ImageSizeMediumControl() {
	const { editor } = useRichTextEditorContext();

	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.updateAttributes("image", {
						width: "500px",
						height: null,
					})
					.run()
			}
			aria-label="Medium image"
			title="Medium image (500px)"
		>
			<span style={{ fontSize: "12px" }}>M</span>
		</MantineRTE.Control>
	);
}

function ImageSizeLargeControl() {
	const { editor } = useRichTextEditorContext();

	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.updateAttributes("image", {
						width: "800px",
						height: null,
					})
					.run()
			}
			aria-label="Large image"
			title="Large image (800px)"
		>
			<span style={{ fontSize: "14px" }}>L</span>
		</MantineRTE.Control>
	);
}

function ImageSizeFullControl() {
	const { editor } = useRichTextEditorContext();

	return (
		<MantineRTE.Control
			onClick={() =>
				editor
					?.chain()
					.focus()
					.updateAttributes("image", {
						width: "100%",
						height: null,
					})
					.run()
			}
			aria-label="Full width image"
			title="Full width image"
		>
			<span style={{ fontSize: "10px" }}>100%</span>
		</MantineRTE.Control>
	);
}

// Format HTML Control
function FormatHtmlControl({
	currentContent,
	onFormatted,
}: {
	currentContent: string;
	onFormatted: (formatted: string) => void;
}) {
	const handleFormat = () => {
		try {
			const result = unified()
				.use(rehypeParse, { fragment: true })
				.use(rehypeFormat)
				.use(rehypeStringify)
				.processSync(currentContent);
			const formatted = result.value.toString().trim();
			onFormatted(formatted);
		} catch (error) {
			console.error("Failed to format HTML:", error);
		}
	};

	return (
		<MantineRTE.Control
			onClick={handleFormat}
			aria-label="Format HTML"
			title="Format HTML"
		>
			<IconCode stroke={1.5} size={16} />
		</MantineRTE.Control>
	);
}

export interface ImageFile {
	id: string;
	file: File;
	preview: string;
}

export interface RichTextEditorRef {
	getImageFiles: () => ImageFile[];
	getEditor: () => Editor | null;
}

interface RichTextEditorProps {
	content?: string;
	placeholder?: string;
	onChange?: (html: string) => void;
	onEditorReady?: (editor: Editor) => void;
	onImageAdd?: (imageFile: ImageFile) => void;
	readonly?: boolean;
	showStatus?: boolean; // Show editor status (character count, word count, etc.)
	disableImageUpload?: boolean; // Disable image upload (also disables Image, Dropcursor, FileHandler extensions)
	disableMentions?: boolean; // Disable @ mentions, [[ page links, and # tag mentions
	disableYoutube?: boolean; // Disable YouTube video embedding
}

const DEBOUNCE_TIME = 300;

export const RichTextEditor = forwardRef<
	RichTextEditorRef,
	RichTextEditorProps
>(function RichTextEditor(
	{
		content = "",
		placeholder = "Start typing...",
		onChange,
		onEditorReady,
		onImageAdd,
		readonly = false,
		showStatus = false,
		disableImageUpload = false,
		disableMentions = false,
		disableYoutube = false,
	},
	ref,
) {
	const [isSourceCodeMode, setIsSourceCodeMode] = useState(false);
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
	const { colorScheme } = useMantineColorScheme();

	// Expose ref methods
	useImperativeHandle(ref, () => ({
		getImageFiles: () => imageFiles,
		getEditor: () => editor,
	}));

	// Internal handler for image addition
	const handleImageAdd = useCallback(
		(imageFile: ImageFile) => {
			setImageFiles((prev) => [...prev, imageFile]);
			// Still call the callback if provided for backward compatibility
			if (onImageAdd) {
				onImageAdd(imageFile);
			}
		},
		[onImageAdd],
	);

	// Debounce the onChange callback to improve performance
	const debouncedOnChange = useDebouncedCallback(
		({ editor }: EditorEvents["update"]) => {
			if (onChange) {
				const html = editor.getHTML();
				if (isSourceCodeMode) return;
				const result = unified()
					.use(rehypeParse, { fragment: true })
					.use(rehypeFormat)
					.use(rehypeStringify)
					.processSync(html);
				const formatted = result.value.toString().trim();
				onChange(formatted);
			}
		},
		DEBOUNCE_TIME,
	);

	// Handle Monaco Editor changes
	const handleMonacoChange = useDebouncedCallback(
		(value: string | undefined) => {
			if (value !== undefined && onChange) {
				const encoded = encode(value);
				editor?.commands.setContent(encoded, { emitUpdate: false });
				// we manually handle the update
				onChange?.(value);
			}
		},
		DEBOUNCE_TIME,
	);

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		extensions: [
			StarterKit.configure({
				link: false,
				codeBlock: false,
				blockquote: false,
			}),
			CalloutBlockquote,
			Link,
			Highlight,
			Superscript,
			SubScript,
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Placeholder.configure({
				placeholder: ({ node }) => {
					if (node.type.name === "detailsSummary") {
						return "Summary";
					}
					return placeholder;
				},
				includeChildren: true,
			}),
			CodeBlockLowlight.extend({
				addNodeView() {
					// @ts-expect-error - ReactNodeViewRenderer types don't perfectly match TipTap's expectations
					return ReactNodeViewRenderer(CodeBlockComponent);
				},
			}).configure({ lowlight }),
			Details.configure({
				persist: true,
				HTMLAttributes: {
					class: "details",
				},
			}),
			DetailsSummary,
			DetailsContent,
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
			// Conditionally include Youtube extension
			...(!disableYoutube
				? [
						Youtube.configure({
							controls: false,
							nocookie: true,
						}),
					]
				: []),
			// Conditionally include Image, Dropcursor, and FileHandler extensions
			...(!disableImageUpload
				? [
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
							allowedMimeTypes: [
								"image/jpeg",
								"image/png",
								"image/gif",
								"image/webp",
							],
							onDrop: (editor, files) => {
								files.forEach(async (file) => {
									const reader = new FileReader();
									reader.onload = () => {
										const id = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
										const preview = reader.result as string;
										const imageFile = { id, file, preview };

										handleImageAdd(imageFile);

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
										const imageFile = { id, file, preview };

										handleImageAdd(imageFile);

										editor.chain().focus().setImage({ src: preview }).run();
									};
									reader.readAsDataURL(file);
								});
							},
						}),
					]
				: []),
			// Conditionally include Mention extensions
			...(!disableMentions
				? [
						Mention.extend({
							name: "userMention",
						}).configure({
							HTMLAttributes: {
								class: "mention mention-user",
							},
							suggestion: createMentionSuggestion("user"),
							renderHTML({ node }) {
								return `@${node.attrs.label}`;
							},
						}),
						Mention.configure({
							HTMLAttributes: {
								class: "mention mention-page",
							},
							suggestion: {
								...createMentionSuggestion("page"),
								char: "[[",
							},
							renderHTML({ node }) {
								return `[[${node.attrs.label}]]`;
							},
						}),
						Mention.extend({
							name: "tagMention",
						}).configure({
							HTMLAttributes: {
								class: "mention mention-tag",
							},
							suggestion: {
								...createMentionSuggestion("tag"),
								char: "#",
							},
							renderHTML({ node }) {
								return `#${node.attrs.label}`;
							},
						}),
					]
				: []),
		],
		content,
		onUpdate: debouncedOnChange,
		onCreate: ({ editor }) => {
			if (onEditorReady) {
				onEditorReady(editor);
			}
		},
		editable: !readonly,
	});

	// Add image resizing functionality
	useImageResize(editor);

	// setEditable
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor is not included in deps intentionally
	useEffect(() => {
		if (editor) {
			editor.setEditable(!readonly);
		}
	}, [readonly]);

	// Use useEditorState to access editor state without causing re-renders
	// This is more performant than accessing editor state directly in the component
	// The selector function ensures only selected state changes trigger re-renders
	//
	// ⚠️ IMPORTANT: Only include primitive/stable values in the selector!
	// DO NOT include editor.getJSON(), editor.getText(), or editor.getHTML() here
	// as they create new references on every transaction, defeating the purpose.
	//
	// Good for selector: isEditable, isEmpty, isFocused, isActive() checks
	// Bad for selector: getJSON(), getText(), getHTML(), state.selection (creates new objects)
	const editorState = useEditorState({
		editor,
		selector: ({ editor }) => {
			if (!editor) return null;

			// For status display, we get character/word counts from HTML
			// Note: These are primitive numbers, so they won't cause unnecessary re-renders
			// const textContent = editor.state.doc.textContent;
			const html = editor.getHTML();
			const textContent = getTextContentFromHtmlClient(html);

			const characterCount = getCharacterCount(textContent);
			const wordCount = getWordCount(textContent);

			return {
				// Editor meta state (stable booleans)
				isEditable: editor.isEditable,
				isEmpty: editor.isEmpty,
				isFocused: editor.isFocused,

				// Statistics (primitive numbers - efficient for status display)
				characterCount,
				wordCount,

				// Active formatting states (for toolbar button states)
				// Only include these if you need them - currently Mantine handles this
				// isBold: editor.isActive('bold'),
				// isItalic: editor.isActive('italic'),
				// isInTable: editor.isActive('table'),
			};
		},
	});

	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
	const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

	const handleEditorDidMount: OnMount = (editor, monaco) => {
		// here is the editor instance
		// you can store it in `useRef` for further usage
		editorRef.current = editor;
		monacoRef.current = monaco;
	};

	return (
		<MantineRTE editor={editor} onSourceCodeTextSwitch={setIsSourceCodeMode}>
			{/* Use editorState for conditional rendering to avoid re-renders */}
			{editor && !readonly && !isSourceCodeMode && editorState && (
				<BubbleMenu
					editor={editor}
					options={{
						placement: "bottom-start",
					}}
				>
					<MantineRTE.ControlsGroup
						onMouseDown={(e) => {
							// Prevent BubbleMenu from closing when clicking color picker
							const target = e.target as HTMLElement;
							if (
								target.closest(".mantine-ColorPicker-root") ||
								target.closest('[role="listbox"]') ||
								target.closest(".mantine-Popover-dropdown")
							) {
								e.preventDefault();
							}
						}}
					>
						<MantineRTE.Bold />
						<MantineRTE.Italic />
						<MantineRTE.Underline />
						<MantineRTE.Strikethrough />
						<MantineRTE.Highlight />
						<MantineRTE.UnsetColor />
					</MantineRTE.ControlsGroup>
				</BubbleMenu>
			)}

			{!readonly && (
				<MantineRTE.Toolbar sticky stickyOffset="var(--docs-header-height)">
					<MantineRTE.ControlsGroup>
						<MantineRTE.SourceCode />
					</MantineRTE.ControlsGroup>

					{isSourceCodeMode && (
						<MantineRTE.ControlsGroup>
							<FormatHtmlControl
								currentContent={content}
								onFormatted={(formatted) => onChange?.(formatted)}
							/>
						</MantineRTE.ControlsGroup>
					)}

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
								<CalloutNoteControl />
								<CalloutTipControl />
								<CalloutImportantControl />
								<CalloutWarningControl />
								<CalloutCautionControl />
							</MantineRTE.ControlsGroup>

							<MantineRTE.ControlsGroup>
								<DetailsControl />
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

							{(!disableImageUpload || !disableYoutube) && (
								<MantineRTE.ControlsGroup>
									{!disableImageUpload && (
										<AddImageControl onImageAdd={handleImageAdd} />
									)}
									{!disableYoutube && <AddYoutubeVideoControl />}
								</MantineRTE.ControlsGroup>
							)}

							{!disableImageUpload && (
								<MantineRTE.ControlsGroup>
									<ImageSizeSmallControl />
									<ImageSizeMediumControl />
									<ImageSizeLargeControl />
									<ImageSizeFullControl />
								</MantineRTE.ControlsGroup>
							)}

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
			)}

			{isSourceCodeMode ? (
				<MonacoEditor
					height="400px"
					language="html"
					value={content}
					onChange={handleMonacoChange}
					theme={colorScheme === "dark" ? "vs-dark" : "light"}
					options={{
						minimap: { enabled: false },
						scrollBeyondLastLine: false,
						fontSize: 14,
						lineNumbers: "on",
						readOnly: readonly,
						wordWrap: "on",
						codeLens: true,
						autoClosingBrackets: "always",
						autoClosingQuotes: "always",
						autoIndent: "full",
					}}
					onMount={handleEditorDidMount}
				/>
			) : (
				<MantineRTE.Content />
			)}

			{/* Optional status bar - demonstrates useEditorState usage */}
			{showStatus && editorState && !isSourceCodeMode && (
				<div
					style={{
						padding: "8px 12px",
						fontSize: "12px",
						color: "var(--mantine-color-dimmed)",
						borderTop: "1px solid var(--mantine-color-default-border)",
						display: "flex",
						gap: "16px",
						justifyContent: "flex-end",
						backgroundColor: "var(--mantine-color-body)",
					}}
				>
					<span>
						{editorState.characterCount} character
						{editorState.characterCount !== 1 ? "s" : ""}
					</span>
					<span>
						{editorState.wordCount} word{editorState.wordCount !== 1 ? "s" : ""}
					</span>
					{editorState.isEmpty && (
						<span style={{ color: "var(--mantine-color-yellow-6)" }}>
							Empty
						</span>
					)}
				</div>
			)}
		</MantineRTE>
	);
});
