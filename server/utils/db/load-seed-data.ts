import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { Result } from "typescript-result";
import { testData } from "./predefined-seed-data";
import { seedDataSchema } from "./seed-schema";
import { SeedDataLoadError } from "app/utils/error";

/**
 * Loads and validates seed data from seed.json file in project root
 * Falls back to testData if file doesn't exist or is invalid
 */
export const tryLoadSeedData = Result.wrap(
	() => {
		const seedJsonPath = "./seed.json";

		// Check if seed.json exists
		if (!existsSync(seedJsonPath)) {
			console.warn(
				"⚠️  seed.json not found in project root, using predefined test data",
			);
			return testData;
		}

		// Read and parse JSON
		let rawJson: unknown;
		try {
			const fileContent = readFileSync(seedJsonPath, "utf-8");
			rawJson = JSON.parse(fileContent);
		} catch (error) {
			console.warn(
				`⚠️  Failed to read or parse seed.json: ${error instanceof Error ? error.message : String(error)}, using predefined test data`,
			);
			return testData;
		}

		// Validate against schema
		const validationResult = seedDataSchema.safeParse(rawJson);
		if (!validationResult.success) {
			console.warn(
				`⚠️  seed.json validation failed: ${validationResult.error.message}, using predefined test data`,
			);
			return testData;
		}

		console.log("✅ Successfully loaded and validated seed.json");
		return validationResult.data;
	},
	(error) =>
		new SeedDataLoadError(
			`Failed to load seed data: ${error instanceof Error ? error.message : String(error)}`, {
			cause: error,
		}
		)
);

