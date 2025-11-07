import type { Migration, Payload } from "payload";
import { migrations } from "src/migrations";
import { Result } from "typescript-result";
import { envVars } from "../../env";
import { tryLoadSeedData } from "./load-seed-data";
import { migrateFresh } from "./migrate-fresh";
import { runSeed } from "./seed";

/**
 * Resets the sandbox database by running migrateFresh and seeding with data
 * Only runs if sandbox mode is enabled
 */
export const tryResetSandbox = Result.wrap(
	async (payload: Payload): Promise<void> => {
		// Check if sandbox mode is enabled
		if (!envVars.SANDBOX_MODE.enabled) {
			return;
		}

		console.log("🔄 Sandbox mode enabled, resetting database...");

		// Run migrateFresh to drop and recreate database
		await migrateFresh({
			payload,
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});

		await Bun.sleep(1000);

		// Load seed data (falls back to testData if seed.json invalid/missing)
		const seedDataResult = tryLoadSeedData();
		if (!seedDataResult.ok) {
			throw new Error(
				`Failed to load seed data: ${seedDataResult.error.message}`,
			);
		}

		const seedData = seedDataResult.value;

		// Run seed with loaded data
		const seedResult = await runSeed({
			payload,
			seedData: seedData,
		});

		if (!seedResult.ok) {
			throw new Error(`Failed to seed database: ${seedResult.error.message}`);
		}

		console.log("✅ Sandbox database reset completed successfully");
	},
	(error) =>
		new Error(
			`Sandbox reset failed: ${error instanceof Error ? error.message : String(error)}`,
		),
);
