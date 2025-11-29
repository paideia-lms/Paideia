import type { CollectionConfig } from "payload";
import { richTextContent } from "./utils/rich-text-content";

// Pages collection - for page-type activity modules
export const Pages = {
	slug: "pages",
	access: {
		read: () => true,
		create: () => true,
		update: () => true,
		delete: () => true,
	},
	fields: [
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
		...richTextContent({
			name: "content",
			type: "textarea",
			label: "Page Content (HTML)",
		}),
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
