import type { CollectionConfig } from "payload";

// Whiteboards collection - for whiteboard-type activity modules
export const Whiteboards = {
	slug: "whiteboards",
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
			label: "Whiteboard Content (JSON)",
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
