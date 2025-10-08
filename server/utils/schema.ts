import { z } from "zod";

const itemSchema = z.object({
	id: z.number(),
});

const sectionSchema = z.object({
	title: z.string(),
	description: z.string(),
	get items() {
		return z.array(itemSchema.or(sectionSchema));
	},
});

export const courseStructureSchema = z.object({
	sections: z.array(sectionSchema),
});

export type CourseStructure = z.infer<typeof courseStructureSchema>;
