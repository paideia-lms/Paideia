import { computePosition, flip, shift } from "@floating-ui/dom";
import { posToDOMRect, ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import {
	type MentionItem,
	MentionList,
	type MentionListRef,
} from "./mention-list";

// Extended type that includes the event property at runtime
type SuggestionKeyDownProps = { event: KeyboardEvent };

const updatePosition = (
	editor: SuggestionProps["editor"],
	element: HTMLElement,
) => {
	const virtualElement = {
		getBoundingClientRect: () =>
			posToDOMRect(
				editor.view,
				editor.state.selection.from,
				editor.state.selection.to,
			),
	};

	computePosition(virtualElement, element, {
		placement: "bottom-start",
		strategy: "absolute",
		middleware: [shift(), flip()],
	}).then(({ x, y, strategy }) => {
		element.style.width = "max-content";
		element.style.position = strategy;
		element.style.left = `${x}px`;
		element.style.top = `${y}px`;
	});
};

// Mock data for mentions
const MOCK_USERS: MentionItem[] = [
	{ id: "user-1", label: "Alice Johnson" },
	{ id: "user-2", label: "Bob Smith" },
	{ id: "user-3", label: "Charlie Brown" },
	{ id: "user-4", label: "Diana Prince" },
	{ id: "user-5", label: "Eve Anderson" },
	{ id: "user-6", label: "Frank Wilson" },
	{ id: "user-7", label: "Grace Lee" },
	{ id: "user-8", label: "Henry Davis" },
];

const MOCK_TAGS: MentionItem[] = [
	{ id: "tag-1", label: "important" },
	{ id: "tag-2", label: "urgent" },
	{ id: "tag-3", label: "question" },
	{ id: "tag-4", label: "idea" },
	{ id: "tag-5", label: "follow-up" },
	{ id: "tag-6", label: "review" },
	{ id: "tag-7", label: "discussion" },
	{ id: "tag-8", label: "announcement" },
];

const MOCK_PAGES: MentionItem[] = [
	{ id: "page-1", label: "Home" },
	{ id: "page-2", label: "About" },
	{ id: "page-3", label: "Contact" },
	{ id: "page-4", label: "Services" },
	{ id: "page-5", label: "Products" },
	{ id: "page-6", label: "Blog" },
];

type MentionType = "user" | "tag" | "page";

export const createMentionSuggestion = (
	type: MentionType,
): Omit<SuggestionOptions<MentionItem>, "editor"> => ({
	items: ({ query }: { query: string }) => {
		const items =
			type === "user" ? MOCK_USERS : type === "tag" ? MOCK_TAGS : MOCK_PAGES;
		return items
			.filter((item) =>
				item.label.toLowerCase().startsWith(query.toLowerCase()),
			)
			.slice(0, 5);
	},
	render: () => {
		let reactRenderer: ReactRenderer<MentionListRef> | undefined;

		return {
			onStart: (props) => {
				if (!props.clientRect) {
					return;
				}

				reactRenderer = new ReactRenderer(MentionList, {
					props,
					editor: props.editor,
				});

				reactRenderer.element.style.position = "absolute";
				reactRenderer.element.style.zIndex = "1000";

				document.body.appendChild(reactRenderer.element);

				updatePosition(props.editor, reactRenderer.element);
			},

			onUpdate(props: SuggestionProps<MentionItem>) {
				if (reactRenderer) {
					reactRenderer.updateProps(props);

					if (!props.clientRect) {
						return;
					}
					updatePosition(props.editor, reactRenderer.element);
				}
			},

			onKeyDown(props: SuggestionKeyDownProps) {
				if (props.event.key === "Escape") {
					if (reactRenderer?.ref) {
						reactRenderer.destroy();
						reactRenderer.element.remove();
					}

					return true;
				}

				return reactRenderer?.ref?.onKeyDown(props) ?? false;
			},

			onExit(props) {
				// console.log("onExit: ", reactRenderer?.ref, props);
				// console.log("selectedItem: ", reactRenderer?.ref?.selectedItem);
				if (reactRenderer?.ref && reactRenderer.ref.selectedItem) {
					reactRenderer.destroy();
					reactRenderer.element.remove();
				}
				if (
					reactRenderer?.ref &&
					!reactRenderer.ref.selectedItem &&
					!props.decorationNode
				) {
					reactRenderer.destroy();
					reactRenderer.element.remove();
				}
			},
		};
	},
});
