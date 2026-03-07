import { z } from "zod";

export const mediaSeedInputSchema = z.object({
	filename: z.string().min(1),
	mimeType: z.string().min(1),
	alt: z.string().optional(),
	caption: z.string().optional(),
	userEmail: z.email(),
	filePath: z.string().min(1),
});

export const mediaSeedDataSchema = z.object({
	media: z.array(mediaSeedInputSchema),
});

export type MediaSeedInput = z.infer<typeof mediaSeedInputSchema>;
export type MediaSeedData = z.infer<typeof mediaSeedDataSchema>;
