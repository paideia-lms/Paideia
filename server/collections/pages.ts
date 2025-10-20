import type { CollectionConfig } from "payload";

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
			name: "content",
			type: "textarea",
			label: "Page Content (HTML)",
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
