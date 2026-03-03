import { SandboxResetError, transformError } from "app/utils/error";
import { Result } from "typescript-result";
import { envVars } from "../../env";
import { tryLoadSeedData } from "./load-seed-data";
import { tryRunSeed } from "./seed";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";

type TryDeleteAllUserDataArgs = BaseInternalFunctionArgs;

/**
 * Deletes all user data from the database while preserving system tables
 * System tables preserved: payload-jobs, payload-jobs-log, payload-migrations, payload-kv, payload-locked-documents, payload-preferences
 */
async function tryDeleteAllUserData(args: TryDeleteAllUserDataArgs) {
	const { payload, req } = args;

	return Result.try(
		async () => {
			// Delete in order to respect foreign key constraints
			// Start with child records and work up to parent records

			// 1. Delete submissions (child records)
			console.log("  Deleting submissions...");
			await payload.delete({
				collection: "assignment-submissions",
				where: {},
				req,
				overrideAccess: true,
			});
			await payload.delete({
				collection: "quiz-submissions",
				where: {},
				req,
				overrideAccess: true,
			});
			await payload.delete({
				collection: "discussion-submissions",
				where: {},
				req,
				overrideAccess: true,
			});

			// 2. Delete user grades
			console.log("  Deleting user grades...");
			await payload.delete({
				collection: "user-grades",
				where: {},
				req,
				overrideAccess: true,
			});

			// 3. Delete gradebook items
			console.log("  Deleting gradebook items...");
			await payload.delete({
				collection: "gradebook-items",
				where: {},
				req,
				overrideAccess: true,
			});

			// 4. Delete gradebook categories
			console.log("  Deleting gradebook categories...");
			await payload.delete({
				collection: "gradebook-categories",
				where: {},
				req,
				overrideAccess: true,
			});

			// 5. Delete gradebooks
			console.log("  Deleting gradebooks...");
			await payload.delete({
				collection: "gradebooks",
				where: {},
				req,
				overrideAccess: true,
			});

			// 6. Delete course grade tables
			console.log("  Deleting course grade tables...");
			await payload.delete({
				collection: "course-grade-tables",
				where: {},
				req,
				overrideAccess: true,
			});

			// 7. Delete course activity module links
			console.log("  Deleting course activity module links...");
			await payload.delete({
				collection: "course-activity-module-links",
				where: {},
				req,
				overrideAccess: true,
			});

			// 8. Delete activity module grants
			console.log("  Deleting activity module grants...");
			await payload.delete({
				collection: "activity-module-grants",
				where: {},
				req,
				overrideAccess: true,
			});

			// 9. Delete enrollments
			console.log("  Deleting enrollments...");
			await payload.delete({
				collection: "enrollments",
				where: {},
				req,
				overrideAccess: true,
			});

			// 10. Delete groups
			console.log("  Deleting groups...");
			await payload.delete({
				collection: "groups",
				where: {},
				req,
				overrideAccess: true,
			});

			// 11. Delete course sections
			console.log("  Deleting course sections...");
			await payload.delete({
				collection: "course-sections",
				where: {},
				req,
				overrideAccess: true,
			});

			// 12. Delete pages
			console.log("  Deleting pages...");
			await payload.delete({
				collection: "pages",
				where: {},
				req,
				overrideAccess: true,
			});

			// 13. Delete whiteboards
			console.log("  Deleting whiteboards...");
			await payload.delete({
				collection: "whiteboards",
				where: {},
				req,
				overrideAccess: true,
			});

			// 14. Delete notes
			console.log("  Deleting notes...");
			await payload.delete({
				collection: "notes",
				where: {},
				req,
				overrideAccess: true,
			});

			// 15. Delete activity modules
			console.log("  Deleting activity modules...");
			await payload.delete({
				collection: "activity-modules",
				where: {},
				req,
				overrideAccess: true,
			});

			// 16. Delete assignments
			console.log("  Deleting assignments...");
			await payload.delete({
				collection: "assignments",
				where: {},
				req,
				overrideAccess: true,
			});

			// 17. Delete quizzes
			console.log("  Deleting quizzes...");
			await payload.delete({
				collection: "quizzes",
				where: {},
				req,
				overrideAccess: true,
			});

			// 18. Delete discussions
			console.log("  Deleting discussions...");
			await payload.delete({
				collection: "discussions",
				where: {},
				req,
				overrideAccess: true,
			});

			// 19. Delete media
			console.log("  Deleting media...");
			await payload.delete({
				collection: "media",
				where: {},
				req,
				overrideAccess: true,
			});

			// 20. Delete courses
			console.log("  Deleting courses...");
			await payload.delete({
				collection: "courses",
				where: {},
				req,
				overrideAccess: true,
			});

			// 21. Delete course categories
			console.log("  Deleting course categories...");
			await payload.delete({
				collection: "course-categories",
				where: {},
				req,
				overrideAccess: true,
			});

			// 22. Delete category role assignments
			console.log("  Deleting category role assignments...");
			await payload.delete({
				collection: "category-role-assignments",
				where: {},
				req,
				overrideAccess: true,
			});

			// 23. Delete users (last, as they may be referenced by other collections)
			console.log("  Deleting users...");
			await payload.delete({
				collection: "users",
				where: {},
				req,
				overrideAccess: true,
			});

			return true;
		},
		(error) => {
			return (
				transformError(error) ??
				new SandboxResetError(
					`Sandbox reset failed: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				)
			);
		},
	);
}

type TryResetSandboxArgs = BaseInternalFunctionArgs;

/**
 * Resets the sandbox database by deleting all user data and seeding with fresh data
 * Only runs if sandbox mode is enabled
 * Preserves system tables: payload-jobs, payload-jobs-log, payload-migrations, etc.
 *
 * if fail, it will rollback the transaction.
 */
export function tryResetSandbox(args: TryResetSandboxArgs) {
	const { payload, req } = args;
	return Result.try(
		async () => {
			// Check if sandbox mode is enabled
			if (!envVars.SANDBOX_MODE.enabled) {
				throw new SandboxResetError("Sandbox mode is not enabled", {
					cause: new Error("Sandbox mode is not enabled"),
				});
			}

			console.log("🔄 Sandbox mode enabled, resetting database...");

			const transactionInfo = await handleTransactionId(payload, req);
			await transactionInfo.tx(async (txInfo) => {
				// Delete all user data while preserving system tables
				(
					await tryDeleteAllUserData({
						payload,
						req: txInfo.reqWithTransaction,
					})
				).getOrThrow();

				await Bun.sleep(1000);

				// Load seed data (falls back to testData if seed.json invalid/missing)
				const seedData = tryLoadSeedData().getOrThrow();

				// Run seed with loaded data
				const seedResult = await tryRunSeed({
					payload: args.payload,
					req: txInfo.reqWithTransaction,
					seedData: seedData,
				}).getOrThrow();

				console.log("✅ Sandbox database reset completed successfully");

				return seedResult;
			});
		},
		(error) => {
			return (
				transformError(error) ??
				new SandboxResetError(
					`Sandbox reset failed: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				)
			);
		},
	);
}
