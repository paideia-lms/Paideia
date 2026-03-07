import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import sanitizedConfig from "../payload.config";
import { getPayload } from "payload";
import { UserModule } from "../index";


/**
 * test the module can instantiate correctly
 */
describe("User Module", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});

	test("should instantiate correctly", () => {
		expect(payload).toBeDefined();
		const userModule = new UserModule(payload);
		expect(userModule).toBeDefined();
	});
});