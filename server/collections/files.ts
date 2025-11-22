import type { CollectionConfig } from "payload";

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
