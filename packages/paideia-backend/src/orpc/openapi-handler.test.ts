import { describe, expect, test } from "bun:test";
import { healthCheck, ping } from "./routers/health";
import { createOpenApiGenerator } from "./openapi-handler";
import { orpcRouter } from "./router";

/** Minimal router with only health/ping */
const minimalRouter = {
	health: { check: healthCheck, ping },
};

describe("OpenAPI spec generation", () => {
	test("should generate valid OpenAPI spec from minimal router", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(minimalRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.info).toEqual({
			title: "Paideia LMS API",
			version: "1.0.0",
		});
		expect(spec.paths).toBeDefined();
		expect(typeof spec.paths).toBe("object");
	});

	test("should include health and ping paths in spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(minimalRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/health"]).toBeDefined();
		expect(paths["/ping"]).toBeDefined();
	});

	test("should generate spec from full orpcRouter", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(orpcRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();
		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/health"]).toBeDefined();
		expect(paths["/courses/{courseId}"]).toBeDefined();
	});
});
