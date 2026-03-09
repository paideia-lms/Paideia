import type { AccessResult, CollectionConfig } from "payload";
import { UserModule } from "@paideia/module-user";

const mediaFieldWithHook = UserModule.fieldHooks.mediaFieldWithHook;

// Files collection - for file-type activity modules (similar to Moodle's file resource)
export const Files = {
	slug: "files" as const,
	defaultSort: "-createdAt",
	access: {
		read: ({ req }): AccessResult => {
			if (!req.user) {
				return false;
			}
			if (req.user.role === "admin") return true;
			return {
				createdBy: {
					equals: req.user.id,
				},
			};
		},
		create: ({ req }): AccessResult => {
			if (!req.user) return false;
			return true;
		},
		update: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return {
				createdBy: {
					equals: req.user.id,
				},
			};
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return {
				createdBy: {
					equals: req.user.id,
				},
			};
		},
	},
	hooks: {
		beforeChange: [],
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		...UserModule.fieldHooks.richTextContentWithHook(
			{
				name: "description",
				type: "textarea",
				label: "Description",
			},
			"File description image",
		).fields,
		...mediaFieldWithHook({
			name: "media",
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: "Attached Files",
		}).fields,
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
			access: {
				update: () => false,
			},
		},
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
