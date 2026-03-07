import type { CollectionConfig } from "payload";
import { richTextContentWithHook } from "server/collections/utils/rich-text-content";

// Files collection - for file-type activity modules
export const Files = {
	slug: "files",
	access: {
		read: () => true,
		create: () => true,
		update: () => true,
		delete: () => true,
	},
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
		}, "File description image").fields,
		{
			name: "media",
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: "Media",
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
