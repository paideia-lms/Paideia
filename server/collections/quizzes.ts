import type { AccessResult, CollectionConfig } from "payload";
import { tryResolveQuizConfigToLatest } from "server/json/raw-quiz-config/version-resolver";

// Quizzes collection - quiz-specific configuration
export const Quizzes = {
	slug: "quizzes",
	defaultSort: "-createdAt",
	access: {
		read: ({ req }) => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			return true;

			// // Allow access if user created it or has access to any activity module using this quiz
			// const activityModules = await req.payload.find({
			// 	collection: "activity-modules",
			// 	where: {
			// 		quiz: { exists: true },
			// 	},
			// 	depth: 0,
			// });

			// const accessibleModuleIds = activityModules.docs
			// 	.filter((mod) => {
			// 		const owner =
			// 			typeof mod.owner === "number" ? mod.owner : mod.owner?.id;
			// 		const createdBy =
			// 			typeof mod.createdBy === "number"
			// 				? mod.createdBy
			// 				: mod.createdBy?.id;
			// 		return owner === req.user?.id || createdBy === req.user?.id;
			// 	})
			// 	.map((mod) => (typeof mod.quiz === "number" ? mod.quiz : mod.quiz?.id))
			// 	.filter((id): id is number => id !== undefined);

			// return {
			// 	or: [
			// 		{ createdBy: { equals: req.user.id } },
			// 		{ id: { in: accessibleModuleIds } },
			// 	],
			// };
		},
		update: async ({ req, data }) => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			return true;

			// const activityModules = await req.payload.find({
			// 	collection: "activity-modules",
			// 	where: {
			// 		quiz: { exists: true },
			// 	},
			// 	depth: 0,
			// });

			// const accessibleModuleIds = activityModules.docs
			// 	.filter((mod) => {
			// 		const owner =
			// 			typeof mod.owner === "number" ? mod.owner : mod.owner?.id;
			// 		const createdBy =
			// 			typeof mod.createdBy === "number"
			// 				? mod.createdBy
			// 				: mod.createdBy?.id;
			// 		return owner === req.user?.id || createdBy === req.user?.id;
			// 	})
			// 	.map((mod) => (typeof mod.quiz === "number" ? mod.quiz : mod.quiz?.id))
			// 	.filter((id): id is number => id !== undefined);

			// return {
			// 	or: [
			// 		{ createdBy: { equals: req.user.id } },
			// 		{ id: { in: accessibleModuleIds } },
			// 	],
			// };
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
			hooks: {
				afterRead: [
					({ value }) => {
						return tryResolveQuizConfigToLatest(value);
					},
				],
			},
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
