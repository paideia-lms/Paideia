import { describe, expect, test } from "bun:test";
import {
	createPage,
	updatePage,
	findPageById,
	searchPages,
	deletePage,
	findPagesByUser,
} from "../api/page-management";
import { createOpenApiGenerator } from "../../../orpc/openapi-handler";

const pagesApiRouter = {
	pages: {
		create: createPage,
		update: updatePage,
		findById: findPageById,
		search: searchPages,
		delete: deletePage,
		findByUser: findPagesByUser,
	},
};

describe("Pages API OpenAPI generation", () => {
	test("should include all page paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/pages"]).toBeDefined();
		expect(paths["/pages/{pageId}"]).toBeDefined();
		expect(paths["/pages/search"]).toBeDefined();
		expect(paths["/pages/by-user/{userId}"]).toBeDefined();
	});

	test("POST /pages should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();

		const postOp = pathItem.post as Record<string, unknown>;
		expect(postOp.requestBody).toBeDefined();
	});

	test("GET /pages/{pageId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages/{pageId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const pageIdParam = params.find((p) => p.name === "pageId");
		expect(pageIdParam).toBeDefined();
		expect(pageIdParam?.in).toBe("path");
	});

	test("PATCH /pages/{pageId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages/{pageId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();

		const patchOp = pathItem.patch as Record<string, unknown>;
		expect(patchOp.parameters).toBeDefined();
		expect(patchOp.requestBody).toBeDefined();
	});

	test("DELETE /pages/{pageId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages/{pageId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();

		const deleteOp = pathItem.delete as Record<string, unknown>;
		expect(deleteOp.parameters).toBeDefined();
		const params = deleteOp.parameters as Array<Record<string, unknown>>;
		const pageIdParam = params.find((p) => p.name === "pageId");
		expect(pageIdParam).toBeDefined();
		expect(pageIdParam?.in).toBe("path");
	});

	test("GET /pages/search should have query parameters", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages/search"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /pages/by-user/{userId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(pagesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/pages/by-user/{userId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const userIdParam = params.find((p) => p.name === "userId");
		expect(userIdParam).toBeDefined();
		expect(userIdParam?.in).toBe("path");
	});
});
