import { z } from "zod";

export const courseSeedInputSchema = z.object({
	title: z.string().min(1),
	slug: z.string().min(1),
	description: z.string(),
	status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
	createdByEmail: z.string().email(),
	thumbnailFilename: z.string().optional(),
	tags: z.array(z.string()).optional(),
	categoryName: z.string().optional(),
});

export const courseSeedDataSchema = z.object({
	courses: z.array(courseSeedInputSchema),
});

export type CourseSeedInput = z.infer<typeof courseSeedInputSchema>;
export type CourseSeedData = z.infer<typeof courseSeedDataSchema>;
