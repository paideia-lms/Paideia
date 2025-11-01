import { z } from "zod";

/**
 * Schema for validating seed data structure
 * Matches the testData structure in server/seed.ts
 */
export const seedDataSchema = z.object({
	admin: z.object({
		email: z.email(),
		password: z.string().min(1),
		firstName: z.string().min(1),
		lastName: z.string().min(1),
	}),
	users: z.object({
		student: z.object({
			email: z.email(),
			password: z.string().min(1),
			firstName: z.string().min(1),
			lastName: z.string().min(1),
		}),
		teacher: z.object({
			email: z.email(),
			password: z.string().min(1),
			firstName: z.string().min(1),
			lastName: z.string().min(1),
		}),
		ta: z.object({
			email: z.email(),
			password: z.string().min(1),
			firstName: z.string().min(1),
			lastName: z.string().min(1),
		}),
		additionalStudents: z.array(
			z.object({
				email: z.email(),
				password: z.string().min(1),
				firstName: z.string().min(1),
				lastName: z.string().min(1),
			}),
		),
	}),
	courses: z.array(
		z.object({
			title: z.string().min(1),
			description: z.string(),
			slug: z.string().min(1),
			status: z.enum(["published", "draft", "archived"]),
		}),
	),
	modules: z.object({
		page: z.object({
			title: z.string().min(1),
			description: z.string(),
			content: z.string(),
		}),
		additional: z.array(
			z.discriminatedUnion("type", [
				z.object({
					type: z.literal("page"),
					title: z.string().min(1),
					description: z.string(),
					status: z.enum(["published", "draft"]),
					content: z.string(),
				}),
				z.object({
					type: z.literal("quiz"),
					title: z.string().min(1),
					description: z.string(),
					status: z.enum(["published", "draft"]),
					instructions: z.string(),
					points: z.number().int().positive(),
					timeLimit: z.number().int().positive(),
				}),
				z.object({
					type: z.literal("assignment"),
					title: z.string().min(1),
					description: z.string(),
					status: z.enum(["published", "draft"]),
					instructions: z.string(),
					dueDate: z.string().datetime(),
					maxAttempts: z.number().int().positive(),
				}),
				z.object({
					type: z.literal("discussion"),
					title: z.string().min(1),
					description: z.string(),
					status: z.enum(["published", "draft"]),
					instructions: z.string(),
					minReplies: z.number().int().nonnegative(),
					threadSorting: z.enum(["recent", "upvoted", "active", "alphabetical"]),
				}),
				z.object({
					type: z.literal("whiteboard"),
					title: z.string().min(1),
					description: z.string(),
					status: z.enum(["published", "draft"]),
				}),
			]),
		),
	}),
	sections: z.array(
		z.object({
			title: z.string().min(1),
			description: z.string(),
		}),
	),
	enrollmentStatuses: z.array(
		z.enum(["active", "inactive", "completed"]),
	),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type SeedData = z.infer<typeof seedDataSchema>;

