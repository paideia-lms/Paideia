import { describe, expect, test } from "bun:test";
import { WhiteboardModule } from "../index";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";

describe("Whiteboard Module", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	test("should be defined", () => {
		expect(payload).toBeDefined();
		const whiteboardModule = new WhiteboardModule(payload);
		expect(whiteboardModule).toBeDefined();
	});
});
