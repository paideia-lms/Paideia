import {
	SandboxResetError,
	SeedDataLoadError,
	transformError,
	UnknownError,
} from "app/utils/error";
import type { Payload } from "payload";
import { createLocalReq } from "payload";
import { Result } from "typescript-result";
import { envVars } from "../../env";
import { tryLoadSeedData } from "./load-seed-data";
import { tryRunSeed } from "./seed";

/**
 * Deletes all user data from the database while preserving system tables
 * System tables preserved: payload-jobs, payload-jobs-log, payload-migrations, payload-kv, payload-locked-documents, payload-preferences
 */
async function deleteAllUserData(payload: Payload): Promise<void> {
	const req = await createLocalReq({}, payload);
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		throw new Error("Failed to begin transaction");
	}

	try {
		const reqWithTransaction = { ...req, transactionID };

		// Delete in order to respect foreign key constraints
		// Start with child records and work up to parent records

		// 1. Delete submissions (child records)
		console.log("  Deleting submissions...");
		await payload.delete({
			collection: "assignment-submissions",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});
		await payload.delete({
			collection: "quiz-submissions",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});
		await payload.delete({
			collection: "discussion-submissions",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 2. Delete user grades
		console.log("  Deleting user grades...");
		await payload.delete({
			collection: "user-grades",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 3. Delete gradebook items
		console.log("  Deleting gradebook items...");
		await payload.delete({
			collection: "gradebook-items",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 4. Delete gradebook categories
		console.log("  Deleting gradebook categories...");
		await payload.delete({
			collection: "gradebook-categories",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 5. Delete gradebooks
		console.log("  Deleting gradebooks...");
		await payload.delete({
			collection: "gradebooks",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 6. Delete course grade tables
		console.log("  Deleting course grade tables...");
		await payload.delete({
			collection: "course-grade-tables",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 7. Delete course activity module links
		console.log("  Deleting course activity module links...");
		await payload.delete({
			collection: "course-activity-module-links",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 8. Delete activity module grants
		console.log("  Deleting activity module grants...");
		await payload.delete({
			collection: "activity-module-grants",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 9. Delete enrollments
		console.log("  Deleting enrollments...");
		await payload.delete({
			collection: "enrollments",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 10. Delete groups
		console.log("  Deleting groups...");
		await payload.delete({
			collection: "groups",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 11. Delete course sections
		console.log("  Deleting course sections...");
		await payload.delete({
			collection: "course-sections",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 12. Delete pages
		console.log("  Deleting pages...");
		await payload.delete({
			collection: "pages",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 13. Delete whiteboards
		console.log("  Deleting whiteboards...");
		await payload.delete({
			collection: "whiteboards",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 14. Delete notes
		console.log("  Deleting notes...");
		await payload.delete({
			collection: "notes",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 15. Delete activity modules
		console.log("  Deleting activity modules...");
		await payload.delete({
			collection: "activity-modules",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 16. Delete assignments
		console.log("  Deleting assignments...");
		await payload.delete({
			collection: "assignments",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 17. Delete quizzes
		console.log("  Deleting quizzes...");
		await payload.delete({
			collection: "quizzes",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 18. Delete discussions
		console.log("  Deleting discussions...");
		await payload.delete({
			collection: "discussions",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 19. Delete media
		console.log("  Deleting media...");
		await payload.delete({
			collection: "media",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 20. Delete courses
		console.log("  Deleting courses...");
		await payload.delete({
			collection: "courses",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 21. Delete course categories
		console.log("  Deleting course categories...");
		await payload.delete({
			collection: "course-categories",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 22. Delete category role assignments
		console.log("  Deleting category role assignments...");
		await payload.delete({
			collection: "category-role-assignments",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// 23. Delete users (last, as they may be referenced by other collections)
		console.log("  Deleting users...");
		await payload.delete({
			collection: "users",
			where: {},
			req: reqWithTransaction,
			overrideAccess: true,
		});

		// Commit transaction
		await payload.db.commitTransaction(transactionID);
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		throw error;
	}
}

/**
 * Resets the sandbox database by deleting all user data and seeding with fresh data
 * Only runs if sandbox mode is enabled
 * Preserves system tables: payload-jobs, payload-jobs-log, payload-migrations, etc.
 */
export const tryResetSandbox = Result.wrap(
	async (payload: Payload): Promise<void> => {
		// Check if sandbox mode is enabled
		if (!envVars.SANDBOX_MODE.enabled) {
			return;
		}

		console.log("🔄 Sandbox mode enabled, resetting database...");

		// Delete all user data while preserving system tables
		await deleteAllUserData(payload);

		await Bun.sleep(1000);

		// Load seed data (falls back to testData if seed.json invalid/missing)
		const seedDataResult = tryLoadSeedData();
		if (!seedDataResult.ok) {
			throw new SandboxResetError(
				`Failed to load seed data: ${seedDataResult.error.message}`,
			);
		}

		const seedData = seedDataResult.value;

		// Run seed with loaded data
		const seedResult = await tryRunSeed({
			payload,
			seedData: seedData,
		});

		if (!seedResult.ok) {
			throw new SeedDataLoadError(
				`Failed to seed database: ${seedResult.error.message}`,
			);
		}

		console.log("✅ Sandbox database reset completed successfully");
	},
	(error) =>
		transformError(error) ??
		new SandboxResetError(
			`Sandbox reset failed: ${error instanceof Error ? error.message : String(error)}`,
		),
);
