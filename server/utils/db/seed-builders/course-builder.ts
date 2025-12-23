import type { Payload } from "payload";
import type { SeedData } from "../seed-schema";
import { tryCreateCourse } from "../../../internal/course-management";
import { seedLogger } from "../seed-utils/logger";
import type { SeedContext, CreatedUsers } from "./user-builder";
import type { CreatedCategory } from "./category-builder";

/**
 * Creates all courses for seeding
 */
export async function buildCourses(
	ctx: SeedContext,
	data: SeedData,
	adminUserId: number,
	categories: CreatedCategory[],
): Promise<Awaited<ReturnType<typeof tryCreateCourse>>["value"][]> {
	seedLogger.section("Creating Courses");

	const courses: Awaited<ReturnType<typeof tryCreateCourse>>["value"][] = [];

	// Create first 6 courses with categories
	for (let i = 0; i < 6; i++) {
		const courseData = data.courses[i];
		if (!courseData) continue;

		const categoryId =
			categories.length > 0 ? categories[i % categories.length]!.id : undefined;

		const course = await tryCreateCourse({
			payload: ctx.payload,
			req: ctx.req,
			data: {
				title: courseData.title,
				description: courseData.description,
				slug: courseData.slug,
				createdBy: adminUserId,
				status: courseData.status,
				category: categoryId,
			},
			overrideAccess: true,
		}).getOrThrow();

		courses.push(course);
		seedLogger.success(`Course created with ID: ${course.id}`);
	}

	// Create uncategorized course
	const uncategorizedCourseData = data.courses[6];
	if (uncategorizedCourseData) {
		const course = await tryCreateCourse({
			payload: ctx.payload,
			req: ctx.req,
			data: {
				title: uncategorizedCourseData.title,
				description: uncategorizedCourseData.description,
				slug: uncategorizedCourseData.slug,
				createdBy: adminUserId,
				status: uncategorizedCourseData.status,
			},
			overrideAccess: true,
		}).getOrThrow();

		courses.push(course);
		seedLogger.success(`Course created with ID: ${course.id}`);
	}

	return courses;
}
