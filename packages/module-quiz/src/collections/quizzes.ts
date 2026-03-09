import type { AccessResult, CollectionConfig } from "payload";

export const Quizzes = {
	slug: "quizzes",
	defaultSort: "-createdAt",
	access: {
		read: ({ req }) => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return true;
		},
		update: async ({ req }) => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return true;
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return {
				createdBy: { equals: req.user.id },
			};
		},
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
			label: "Quiz Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Quiz Description",
		},
		{
			name: "instructions",
			type: "textarea",
			label: "Instructions for Students",
		},
		{
			name: "rawQuizConfig",
			type: "json",
			label: "Raw Quiz Configuration",
			required: true,
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
