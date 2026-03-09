import { z } from "zod";

export const whiteboardSeedInputSchema = z.object({
	title: z.string().min(1).max(500),
	description: z.string().optional(),
	content: z.string().optional(),
	userEmail: z.string().email(),
});

export const whiteboardSeedDataSchema = z.object({
	whiteboards: z.array(whiteboardSeedInputSchema),
});

export type WhiteboardSeedInput = z.infer<typeof whiteboardSeedInputSchema>;
export type WhiteboardSeedData = z.infer<typeof whiteboardSeedDataSchema>;
