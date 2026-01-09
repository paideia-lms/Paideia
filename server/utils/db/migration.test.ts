import { beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import sanitizedConfig from "server/payload.config";
import { getPayload } from "payload";
import { testData } from "./predefined-seed-data";
import { tryRunSeed } from "./seed";
describe("Migration", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		payload = await getPayload({
			config: sanitizedConfig,
		});
	});

	it("migrate fresh", async () => {
		await $`bun run migrate:fresh --force-accept-warning`;
	});

	it("run seed", async () => {
		const seedResult = await tryRunSeed({
			payload,
			req: undefined,
			seedData: testData,
		});
		expect(seedResult.ok).toBe(true);
	});

	it("migrate down", async () => {
		await $`bun run migrate:down`;
	});
});
