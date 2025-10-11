import {
	getTaskListExtension,
	Link,
	RichTextEditor as MantineRTE,
	useRichTextEditorContext,
} from "@mantine/tiptap";
import {
	IconColumnInsertLeft,
	IconColumnInsertRight,
	IconColumnRemove,
	IconColumns3,
	IconContainer,
	IconLayoutNavbar,
	IconLayoutSidebar,
	IconRowInsertBottom,
	IconRowInsertTop,
	IconRowRemove,
	IconTable,
	IconTableOff,
} from "@tabler/icons-react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import SubScript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TipTapTaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { type Editor, useEditor } from "@tiptap/react";
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
import { useState } from "react";

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

interface RichTextEditorProps {
	content?: string;
	placeholder?: string;
	onChange?: (content: string) => void;
	onEditorReady?: (editor: Editor) => void;
}

export function RichTextEditor({
	content = "",
	placeholder = "Start typing...",
	onChange,
	onEditorReady,
}: RichTextEditorProps) {
	const [isSourceCodeMode, setIsSourceCodeMode] = useState(false);

	const editor = useEditor({
		immediatelyRender: false,
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

	return (
		<MantineRTE editor={editor} onSourceCodeTextSwitch={setIsSourceCodeMode}>
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
