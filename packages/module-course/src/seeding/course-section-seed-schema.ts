import { z } from "zod";

export const courseSectionSeedInputSchema = z.object({
	courseSlug: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	parentSectionTitle: z.string().optional(),
	contentOrder: z.number().int().min(0).optional().default(0),
});

export const courseSectionSeedDataSchema = z.object({
	sections: z.array(courseSectionSeedInputSchema),
});

export type CourseSectionSeedInput = z.infer<typeof courseSectionSeedInputSchema>;
export type CourseSectionSeedData = z.infer<typeof courseSectionSeedDataSchema>;
