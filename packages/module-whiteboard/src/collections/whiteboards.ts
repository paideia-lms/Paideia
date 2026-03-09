import type { AccessResult, CollectionConfig } from "payload";
import { UserModule } from "@paideia/module-user";

// Whiteboards collection - for whiteboard-type activity modules
export const Whiteboards = {
	slug: "whiteboards" as const,
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
			},
			"Whiteboard description image",
		).fields,
		{
			name: "content",
			type: "textarea",
			label: "Whiteboard Content (JSON)",
			validate: (value: string | null | undefined) => {
				if (!value || value.trim() === "") {
					return true;
				}

				try {
					JSON.parse(value);
					return true;
				} catch (error) {
					return `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
				}
			},
		},
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
