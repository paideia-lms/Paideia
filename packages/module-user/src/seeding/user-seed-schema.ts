import { z } from "zod";

const userRoleSchema = z.enum([
	"admin",
	"content-manager",
	"analytics-viewer",
	"instructor",
	"student",
]);

export const userSeedInputSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	role: userRoleSchema,
	generateApiKey: z.boolean().optional().default(false),
	login: z.boolean().optional(),
});

export const userSeedDataSchema = z.object({
	users: z.array(userSeedInputSchema),
});

export type UserSeedInput = z.infer<typeof userSeedInputSchema>;
export type UserSeedData = z.infer<typeof userSeedDataSchema>;
