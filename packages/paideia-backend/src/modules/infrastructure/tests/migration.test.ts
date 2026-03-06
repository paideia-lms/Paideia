import { beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import sanitizedConfig from "server/payload.config";
import { getPayload } from "payload";
// import { testData } from "../../../utils/db/predefined-seed-data";
// import { tryRunSeed } from "../../../utils/db/seed";
describe("Migration", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});

	it("migrate fresh", async () => {
		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});
	});

	// it("run seed", async () => {
	// const seedResult = await tryRunSeed({
	// 	payload,
	// 	req: undefined,
	// 	seedData: testData,
	// });
	// expect(seedResult.ok).toBe(true);
	// });

	it("migrate down", async () => {
		await payload.db.migrateDown();
	});
});
