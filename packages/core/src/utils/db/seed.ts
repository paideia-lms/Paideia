import { SeedDataLoadError, transformError } from "../../errors";
import { Result } from "typescript-result";
import { tryGetUserCount } from "../../modules/user/services/user-management";
import { testData } from "./predefined-seed-data";
import type { SeedData } from "./seed-schema";
import { seedLogger } from "./seed-utils/logger";
import {
	orchestrateSeed,
	printSeedSummary,
	type TryRunSeedArgs,
} from "./seed-orchestrator";

/**
 * Seeds the development database with initial data
 * Only runs if the database is fresh (no users exist)
 */
export function tryRunSeed(args: TryRunSeedArgs) {
	return Result.try(
		async () => {
			const { payload, req, seedData, vfs = {} } = args;
			// Convert readonly seed data to mutable if needed
			const data = (seedData ?? testData) as SeedData;

			seedLogger.info("🌱 Checking if database needs seeding...");

			const userCount = await tryGetUserCount({
				payload,
				req,
				overrideAccess: true,
			}).getOrThrow();

			if (userCount > 0) {
				seedLogger.success("Database already has users, skipping seed");
				return "user-exists" as const;
			}

			seedLogger.info("🌱 Database is fresh, starting seed process...");

			const result = await orchestrateSeed(payload, req, data, vfs);

			seedLogger.success("🎉 Seed process completed successfully!");
			printSeedSummary(result);

			return result;
		},
		(error) =>
			transformError(error) ??
			new SeedDataLoadError(
				`Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
			),
	);
}
