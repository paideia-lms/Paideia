import type { AccessResult, CollectionConfig } from "payload";

/**
 * notes are like journals and tweets
 * it is pure markdown content.
 *
 * ! in the future, we might version control the notes
 */
export const Notes = {
	slug: "notes" as const,
	defaultSort: "-createdAt",
	access: {
		read: ({ req, data }): AccessResult => {
			// require login to read notes
			if (!req.user) {
				return false;
			}

			// admin can read all notes
			if (req.user.role === "admin") return true;
			// user can read their own notes unless it is public
			return {
				or: [
					{
						createdBy: {
							equals: req.user.id,
						},
					},
					{
						isPublic: {
							equals: true,
						},
					},
				],
			};
		},
		create: ({ req }): AccessResult => {
			// require login to create notes
			if (!req.user) return false;
			// all users can create notes
			return true;
		},
		update: ({ req, data }): AccessResult => {
			// require login to update notes
			if (!req.user) return false;
			// admin can update all notes
			if (req.user.role === "admin") return true;
			// user can update their own notes
			return {
				createdBy: {
					equals: req.user.id,
				},
			};
		},
		delete: ({ req, data }): AccessResult => {
			// require login to delete notes
			if (!req.user) return false;
			// admin can delete all notes
			if (req.user.role === "admin") return true;
			// user can delete their own notes
			return {
				createdBy: {
					equals: req.user.id,
				},
			};
		},
	},
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
		{
			name: "isPublic",
			type: "checkbox",
			label: "Is Public",
			defaultValue: false,
		},
	],
} as const satisfies CollectionConfig;
