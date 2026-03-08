import { beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration } from "payload";
import sanitizedConfig from "payload.config";
import { NoteModule } from "../index";
import { migrations } from "src/migrations";
import { InfrastructureModule } from "@paideia/module-infrastructure";

describe("Note Module", async () => {
    const payload = await getPayload({
        key: `test-${Math.random().toString(36).substring(2, 15)}`,
        config: sanitizedConfig,
    });
    const infrastructureModule = new InfrastructureModule(payload);
    beforeAll(async () => {
        await infrastructureModule.migrateFresh({
            migrations: migrations as Migration[],
            forceAcceptWarning: true,
        });
        await infrastructureModule.cleanS3();
    });

    test("should instantiate correctly", () => {
        expect(payload).toBeDefined();
        const noteModule = new NoteModule(payload);
        expect(noteModule).toBeDefined();
    });
});