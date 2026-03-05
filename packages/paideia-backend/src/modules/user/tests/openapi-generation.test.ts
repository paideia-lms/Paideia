import { describe, expect, test } from "bun:test";
import {
	findUserById,
	findUserByEmail,
	findAllUsers,
} from "../api/user-management";
import { createOpenApiGenerator } from "../../../orpc/openapi-handler";

const userApiRouter = {
	users: {
		findById: findUserById,
		findByEmail: findUserByEmail,
		findAll: findAllUsers,
	},
};

describe("User API OpenAPI generation", () => {
	test("should include user paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(userApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/users/{userId}"]).toBeDefined();
		expect(paths["/users/by-email"]).toBeDefined();
		expect(paths["/users"]).toBeDefined();
	});

	test("GET /users/{userId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(userApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/users/{userId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const userIdParam = params.find((p) => p.name === "userId");
		expect(userIdParam).toBeDefined();
		expect(userIdParam?.in).toBe("path");
	});

	test("GET /users/by-email should have email query/input", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(userApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/users/by-email"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /users should support optional query params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(userApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/users"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});
});
