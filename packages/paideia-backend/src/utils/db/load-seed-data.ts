import { existsSync, readFileSync } from "node:fs";
import { SeedDataLoadError } from "../../errors";
import { Result } from "typescript-result";
import { testData } from "./predefined-seed-data";
import { seedDataSchema } from "./seed-schema";
import { Payload } from "payload";


/**
 * Loads and validates seed data from seed.json file in project root
 * Falls back to testData if file doesn't exist or is invalid
 */
export function tryLoadSeedData({ 
	logger
} : {
	logger: Payload["logger"]
}) {
	return Result.try(
		() => {
			const seedJsonPath = "./seed.json";

			// Check if seed.json exists
			if (!existsSync(seedJsonPath)) {
				logger.warn(
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
				logger.warn(
					`⚠️  Failed to read or parse seed.json: ${error instanceof Error ? error.message : String(error)}, using predefined test data`,
				);
				return testData;
			}

			// Validate against schema
			const validationResult = seedDataSchema.safeParse(rawJson);
			if (!validationResult.success) {
				logger.warn(
					`⚠️  seed.json validation failed: ${validationResult.error.message}, using predefined test data`,
				);
				return testData;
			}

			logger.info("✅ Successfully loaded and validated seed.json");
			return validationResult.data;
		},
		(error) =>
			new SeedDataLoadError(
				`Failed to load seed data: ${error instanceof Error ? error.message : String(error)}`,
				{
					cause: error,
				},
			),
	);
}
