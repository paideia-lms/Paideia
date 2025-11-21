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
		// ! we need this media relationship field to track the media used in the page content
		// ! content is rich text 
		{
			name: "media",
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: "Media",
		},
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
