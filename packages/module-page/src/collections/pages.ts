import type { AccessResult, CollectionConfig } from "payload";
import { UserModule } from "@paideia/module-user";

// Pages collection - for page-type activity modules
export const Pages = {
	slug: "pages" as const,
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
			"Page description image",
		).fields,
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
		...UserModule.fieldHooks.richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Page Content (HTML)",
			},
			"Page content image",
		).fields,
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
