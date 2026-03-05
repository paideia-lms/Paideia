import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import sanitizedConfig from "server/payload.config";
import { getPayload } from "payload";
import { UserModule } from "../index";


/**
 * test the module can instantiate correctly
 */
describe("User Module", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		payload = await getPayload({
			config: sanitizedConfig,
		});
	});

    test("should instantiate correctly", () => {
        expect(payload).toBeDefined();
        const userModule = new UserModule(payload);
        expect(userModule).toBeDefined();
    });
});