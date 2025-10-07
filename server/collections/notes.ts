import type { CollectionConfig } from "payload";

/**
 * notes are like journals and tweets
 * it is pure markdown content.
 *
 * ! in the future, we might version control the notes
 */
export const Notes = {
	slug: "notes" as const,
	defaultSort: "-createdAt",
	fields: [
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
		{
			name: "content",
			type: "textarea",
			required: true,
		},
	],
} as const satisfies CollectionConfig;
