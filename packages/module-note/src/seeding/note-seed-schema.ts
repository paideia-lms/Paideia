import { z } from "zod";

export const noteSeedInputSchema = z.object({
	content: z.string().min(1),
	userEmail: z.email(),
	isPublic: z.boolean().optional().default(false),
});

export const noteSeedDataSchema = z.object({
	notes: z.array(noteSeedInputSchema),
});

export type NoteSeedInput = z.infer<typeof noteSeedInputSchema>;
export type NoteSeedData = z.infer<typeof noteSeedDataSchema>;
