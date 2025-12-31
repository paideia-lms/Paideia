import { describe, it } from "bun:test";
import { $ } from "bun";
describe("Migration", () => {
	it("migrate fresh", async () => {
		await $`bun run migrate:fresh --force-accept-warning`;
	});

	it("migrate down", async () => {
		await $`bun run migrate:down`;
	});
});
