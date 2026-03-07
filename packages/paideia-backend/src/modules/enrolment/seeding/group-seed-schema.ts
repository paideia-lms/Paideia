import { z } from "zod";

export const groupSeedInputSchema = z.object({
	name: z.string().min(1),
	courseSlug: z.string(),
	parentGroupPath: z.string().optional(),
	description: z.string().optional(),
	color: z.string().optional(),
	maxMembers: z.number().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const groupSeedDataSchema = z.object({
	groups: z.array(groupSeedInputSchema),
});

export type GroupSeedInput = z.infer<typeof groupSeedInputSchema>;
export type GroupSeedData = z.infer<typeof groupSeedDataSchema>;
