import { beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../../../payload.config";
import { NoteModule } from "../index";

describe("Note Module", async () => {
    const payload = await getPayload({
        key: `test-${Math.random().toString(36).substring(2, 15)}`,
        config: sanitizedConfig,
    });

    beforeAll(async () => {
    });

    test("should instantiate correctly", () => {
        expect(payload).toBeDefined();
        const noteModule = new NoteModule(payload);
        expect(noteModule).toBeDefined();
    });
});