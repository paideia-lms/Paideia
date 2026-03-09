import { z } from "zod";

export const enrollmentSeedInputSchema = z.object({
	userEmail: z.string().email(),
	courseSlug: z.string(),
	role: z.enum(["student", "teacher", "ta", "manager"]).default("student"),
	status: z.enum(["active", "inactive", "completed", "dropped"]).optional().default("active"),
	enrolledAt: z.string().optional(),
	completedAt: z.string().optional(),
	groupPaths: z.array(z.string()).optional(),
});

export const enrollmentSeedDataSchema = z.object({
	enrollments: z.array(enrollmentSeedInputSchema),
});

export type EnrollmentSeedInput = z.infer<typeof enrollmentSeedInputSchema>;
export type EnrollmentSeedData = z.infer<typeof enrollmentSeedDataSchema>;
