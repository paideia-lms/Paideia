import { describe, expect, test } from "bun:test";
import { PagesModule } from "../index";
import { getPayload } from "payload";
import sanitizedConfig from "server/payload.config";

describe("Pages Module", async () => {
    const payload = await getPayload({
        key: `test-${Math.random().toString(36).substring(2, 15)}`,
        config: sanitizedConfig,
    });
    test("should be defined", () => {
        expect(payload).toBeDefined();
        const pagesModule = new PagesModule(payload);
        expect(pagesModule).toBeDefined();
    });
});