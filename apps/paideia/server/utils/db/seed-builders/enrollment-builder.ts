import type { SeedData } from "../seed-schema";
import { tryCreateEnrollment } from "../../../internal/enrollment-management";
import { seedLogger } from "../seed-utils/logger";
import type { SeedContext, CreatedUsers } from "./user-builder";

type Course = Awaited<
	ReturnType<
		typeof import("../../../internal/course-management").tryCreateCourse
	>
>["value"];

export interface CreatedEnrollments {
	student: Awaited<ReturnType<typeof tryCreateEnrollment>>["value"];
	teacher: Awaited<ReturnType<typeof tryCreateEnrollment>>["value"];
	ta: Awaited<ReturnType<typeof tryCreateEnrollment>>["value"];
	admin?: Awaited<ReturnType<typeof tryCreateEnrollment>>["value"];
	additional: Awaited<ReturnType<typeof tryCreateEnrollment>>["value"][];
}

/**
 * Creates a single enrollment
 */
async function createEnrollment(
	ctx: SeedContext,
	userId: number,
	courseId: number,
	role: "student" | "teacher" | "ta" | "manager",
	status: "active" | "inactive" | "completed",
): Promise<Awaited<ReturnType<typeof tryCreateEnrollment>>["value"]> {
	return await tryCreateEnrollment({
		payload: ctx.payload,
		userId,
		course: courseId,
		role,
		status,
		req: ctx.req,
		overrideAccess: true,
	}).getOrThrow();
}

/**
 * Creates all enrollments for seeding
 */
export async function buildEnrollments(
	ctx: SeedContext,
	data: SeedData,
	users: CreatedUsers,
	courses: Course[],
): Promise<CreatedEnrollments> {
	seedLogger.section("Creating Enrollments");

	if (courses.length === 0) {
		throw new Error("No courses available for enrollment");
	}

	const mainCourse = courses[0];
	if (!mainCourse) {
		throw new Error("No main course available");
	}

	// Create main enrollments
	seedLogger.info("🎓 Enrolling users in course...");

	const student = await createEnrollment(
		ctx,
		users.student.id,
		mainCourse.id,
		"student",
		"active",
	);
	if (!student) {
		throw new Error("Failed to create student enrollment");
	}
	seedLogger.success(`Student enrollment created with ID: ${student.id}`);

	const teacher = await createEnrollment(
		ctx,
		users.teacher.id,
		mainCourse.id,
		"teacher",
		"active",
	);
	if (!teacher) {
		throw new Error("Failed to create teacher enrollment");
	}
	seedLogger.success(`Teacher enrollment created with ID: ${teacher.id}`);

	const ta = await createEnrollment(
		ctx,
		users.ta.id,
		mainCourse.id,
		"ta",
		"active",
	);
	if (!ta) {
		throw new Error("Failed to create TA enrollment");
	}
	seedLogger.success(`TA enrollment created with ID: ${ta.id}`);

	// Create admin enrollment if second course exists
	let admin: CreatedEnrollments["admin"];
	if (courses.length > 1) {
		const secondCourse = courses[1];
		if (secondCourse) {
			seedLogger.info("🧑‍💼 Enrolling admin as manager...");
			admin = await createEnrollment(
				ctx,
				users.admin.id,
				secondCourse.id,
				"manager",
				"active",
			);
			seedLogger.success(
				`Admin enrolled as manager in course ID: ${secondCourse.id}`,
			);
		}
	}

	// Create additional student enrollments
	seedLogger.info("🎓 Enrolling additional students...");
	const additional: CreatedEnrollments["additional"] = [];
	for (let i = 0; i < users.additional.length; i++) {
		const student = users.additional[i];
		if (!student) continue;

		const status = data.enrollmentStatuses[i % data.enrollmentStatuses.length]!;
		const enrollment = await createEnrollment(
			ctx,
			student.id,
			mainCourse.id,
			"student",
			status,
		);
		if (enrollment) {
			additional.push(enrollment);
			seedLogger.success(
				`Additional student enrollment created with ID: ${enrollment.id}`,
			);
		}
	}

	return { student, teacher, ta, admin, additional };
}
