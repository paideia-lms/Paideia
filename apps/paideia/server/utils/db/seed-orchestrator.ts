import type { Simplify } from "drizzle-orm/utils";
import type { SeedData } from "./seed-schema";
import { seedLogger } from "./seed-utils/logger";
import { buildUsers, type CreatedUsers } from "./seed-builders/user-builder";
import {
	buildCategories,
	type CreatedCategory,
} from "./seed-builders/category-builder";
import { buildCourses } from "./seed-builders/course-builder";
import {
	buildEnrollments,
	type CreatedEnrollments,
} from "./seed-builders/enrollment-builder";
import {
	buildModules,
	type CreatedModules,
} from "./seed-builders/module-builder";
import {
	buildSections,
	buildModuleLinks,
} from "./seed-builders/section-builder";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";

type DeepReadonly<T> = Simplify<{
	readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
}>;

export interface TryRunSeedArgs extends BaseInternalFunctionArgs {
	seedData?: SeedData | DeepReadonly<SeedData>;
}

export interface SeedResult {
	users: CreatedUsers;
	categories: CreatedCategory[];
	courses: Awaited<ReturnType<typeof buildCourses>>;
	enrollments: CreatedEnrollments;
	modules: CreatedModules;
	sections: Awaited<ReturnType<typeof buildSections>>;
	links: Awaited<ReturnType<typeof buildModuleLinks>>;
}

/**
 * Orchestrates the entire seed process.
 *
 * if fail, it will rollback the transaction.
 */
export async function orchestrateSeed(
	payload: BaseInternalFunctionArgs["payload"],
	req: BaseInternalFunctionArgs["req"],
	data: SeedData,
) {
	const transactionInfo = await handleTransactionId(payload, req);
	return await transactionInfo.tx(async (txInfo) => {
		const ctx = {
			payload,
			req: txInfo.reqWithTransaction,
		};

		// Step 1: Create users
		const users = await buildUsers(ctx, data);

		// Step 2: Create categories
		const categories = await buildCategories(ctx);

		// Step 3: Create courses
		const courses = await buildCourses(ctx, data, users.admin.id, categories);

		if (courses.length === 0) {
			throw new Error("No courses were created, cannot proceed");
		}

		const mainCourse = courses[0]!;

		// Step 4: Create enrollments
		const enrollments = await buildEnrollments(ctx, data, users, courses);

		// Step 5: Create modules
		const modules = await buildModules(ctx, data, users.admin.id);

		// Step 6: Create sections
		const sections = await buildSections(ctx, data, mainCourse.id);

		// Step 7: Link modules to sections
		const allModules = [modules.page, ...modules.additional];
		const links = await buildModuleLinks(
			ctx,
			mainCourse.id,
			allModules,
			sections,
		);

		return {
			users,
			categories,
			courses,
			enrollments,
			modules,
			sections,
			links,
		};
	});
}

/**
 * Prints seed summary
 */
export function printSeedSummary(result: SeedResult): void {
	seedLogger.section("Seed Summary");
	seedLogger.info(
		`   - Admin user: ${result.users.admin.email} (ID: ${result.users.admin.id})`,
	);
	seedLogger.info(
		`   - Student user: ${result.users.student.email} (ID: ${result.users.student.id})`,
	);
	seedLogger.info(
		`   - Teacher user: ${result.users.teacher.email} (ID: ${result.users.teacher.id})`,
	);
	seedLogger.info(
		`   - TA user: ${result.users.ta.email} (ID: ${result.users.ta.id})`,
	);
	seedLogger.info(
		`   - Additional students: ${result.users.additional.length} created`,
	);
	seedLogger.info(`   - Courses: ${result.courses.length} created`);
	seedLogger.info(
		`   - Main course: ${result.courses[0]!.title} (ID: ${result.courses[0]!.id})`,
	);
	seedLogger.info(
		`   - Student enrollment: Student enrolled as ${result.enrollments.student?.role}`,
	);
	seedLogger.info(
		`   - Teacher enrollment: Teacher enrolled as ${result.enrollments.teacher?.role}`,
	);
	seedLogger.info(
		`   - TA enrollment: TA enrolled as ${result.enrollments.ta?.role}`,
	);
	seedLogger.info(
		`   - Additional enrollments: ${result.enrollments.additional.length} created`,
	);
	seedLogger.info(
		`   - Page module: ${result.modules.page.title} (ID: ${result.modules.page.id})`,
	);
	seedLogger.info(
		`   - Additional modules: ${result.modules.additional.length} created`,
	);
	seedLogger.info(`   - Course sections: ${result.sections.length} created`);
	seedLogger.info(
		`   - Course links: ${result.links.length} modules linked to sections`,
	);
}
