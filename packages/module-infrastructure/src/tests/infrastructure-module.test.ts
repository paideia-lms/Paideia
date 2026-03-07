import { beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import { InfrastructureModule } from "../index";

describe("Infrastructure Module", async () => {
    const payload = await getPayload({
        key: `test-${Math.random().toString(36).substring(2, 15)}`,
        config: sanitizedConfig,
    });

    beforeAll(async () => {
        // await until payload.db.drizzle is ready
        while (!payload.db.drizzle) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        await payload.db.migrateFresh({
            forceAcceptWarning: true,
        });
    });

    test("should instantiate correctly", () => {
        expect(payload).toBeDefined();
        const infrastructureModule = new InfrastructureModule(payload);
        expect(infrastructureModule).toBeDefined();
    });
});