import { z } from "zod";

export const pageSeedInputSchema = z.object({
	title: z.string().min(1).max(500),
	description: z.string().optional(),
	content: z.string().optional(),
	userEmail: z.string().email(),
});

export const pageSeedDataSchema = z.object({
	pages: z.array(pageSeedInputSchema),
});

export type PageSeedInput = z.infer<typeof pageSeedInputSchema>;
export type PageSeedData = z.infer<typeof pageSeedDataSchema>;
