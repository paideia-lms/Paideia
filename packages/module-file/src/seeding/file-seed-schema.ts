import { z } from "zod";

export const fileSeedInputSchema = z.object({
	title: z.string().min(1).max(500),
	description: z.string().optional(),
	mediaFilenames: z.array(z.string()).optional(),
	userEmail: z.string().email(),
});

export const fileSeedDataSchema = z.object({
	files: z.array(fileSeedInputSchema),
});

export type FileSeedInput = z.infer<typeof fileSeedInputSchema>;
export type FileSeedData = z.infer<typeof fileSeedDataSchema>;
