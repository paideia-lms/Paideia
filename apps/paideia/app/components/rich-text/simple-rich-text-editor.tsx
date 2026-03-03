import type { Editor } from "@tiptap/core";
import { RichTextEditor } from "./rich-text-editor";

interface SimpleRichTextEditorProps {
	content?: string;
	placeholder?: string;
	onChange?: (content: string) => void;
	onEditorReady?: (editor: Editor) => void;
	readonly?: boolean;
	showStatus?: boolean;
}

/**
 * SimpleRichTextEditor - A simplified version of RichTextEditor
 *
 * This component wraps RichTextEditor with the following features disabled:
 * - Image upload (and related extensions: Dropcursor, FileHandler)
 * - Mentions (@ user mentions, [[ page links, # tag mentions)
 * - YouTube video embedding
 *
 * Use this for basic text editing needs where advanced media features aren't required.
 */
export function SimpleRichTextEditor({
	content,
	placeholder,
	onChange,
	onEditorReady,
	readonly = false,
	showStatus = false,
}: SimpleRichTextEditorProps) {
	return (
		<RichTextEditor
			content={content}
			placeholder={placeholder}
			onChange={onChange}
			onEditorReady={onEditorReady}
			readonly={readonly}
			showStatus={showStatus}
			disableImageUpload
			disableMentions
			disableYoutube
		/>
	);
}
