import { describe, test, expect } from "bun:test";
import { createCliRouter } from "./commands";

describe("cli/commands", () => {
    test("should create a cli router", () => {
        const router = createCliRouter();
        expect(router).toBeDefined();
        console.log(router);
    });
});