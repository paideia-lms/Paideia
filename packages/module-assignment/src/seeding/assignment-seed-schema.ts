import { z } from "zod";

export const AssignmentSeedInputSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	instructions: z.string().optional(),
	courseSlug: z.string(),
	sectionTitle: z.string(),
	dueDate: z.string().optional(),
	maxAttempts: z.number().optional(),
	maxGrade: z.number().optional(),
	requireTextSubmission: z.boolean().optional(),
	requireFileSubmission: z.boolean().optional(),
	createdByEmail: z.string().email(),
});

export const AssignmentSeedDataSchema = z.object({
	assignments: z.array(AssignmentSeedInputSchema),
});

export type AssignmentSeedInput = z.infer<typeof AssignmentSeedInputSchema>;
export type AssignmentSeedData = z.infer<typeof AssignmentSeedDataSchema>;
