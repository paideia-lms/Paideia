import type { CollectionConfig } from "payload";
import {

	richTextContentWithHook,
} from "../../../collections/utils/rich-text-content";

// Pages collection - for page-type activity modules
export const Pages = {
	slug: "pages",
	hooks: {
		beforeChange: [
			// createRichTextBeforeChangeHook({
			// 	fields: [{ key: "content", alt: "Page content image" }],
			// }),
		],
	},
	fields: [
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
		...richTextContentWithHook({
			name: "content",
			type: "textarea",
			label: "Page Content (HTML)",
		}, "Page content image").fields,
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
