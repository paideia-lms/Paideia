import type { CollectionConfig } from "payload";
import { richTextContentWithHook } from "server/collections/utils/rich-text-content";

// Whiteboards collection - for whiteboard-type activity modules
export const Whiteboards = {
	slug: "whiteboards",
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		...richTextContentWithHook({
			/**
			 * in page and whiteboard, this is basically the content
			 */
			name: "description",
			type: "textarea",
		}, "Whiteboard description image").fields,
		{
			name: "content",
			type: "textarea",
			label: "Whiteboard Content (JSON)",
			validate: (value: string | null | undefined) => {
				// Allow empty content
				if (!value || value.trim() === "") {
					return true;
				}

				// Validate that content is valid JSON
				try {
					JSON.parse(value);
					return true;
				} catch (error) {
					return `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
				}
			},
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
