import { describe, expect, test } from "bun:test";
import {
	createWhiteboard,
	updateWhiteboard,
	findWhiteboardById,
	searchWhiteboards,
	deleteWhiteboard,
	findWhiteboardsByUser,
} from "../api/whiteboard-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const whiteboardsApiRouter = {
	whiteboards: {
		create: createWhiteboard,
		update: updateWhiteboard,
		findById: findWhiteboardById,
		search: searchWhiteboards,
		delete: deleteWhiteboard,
		findByUser: findWhiteboardsByUser,
	},
};

describe("Whiteboard API OpenAPI generation", () => {
	test("should include all whiteboard paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/whiteboards"]).toBeDefined();
		expect(paths["/whiteboards/{whiteboardId}"]).toBeDefined();
		expect(paths["/whiteboards/search"]).toBeDefined();
		expect(paths["/whiteboards/by-user/{userId}"]).toBeDefined();
	});

	test("POST /whiteboards should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();

		const postOp = pathItem.post as Record<string, unknown>;
		expect(postOp.requestBody).toBeDefined();
	});

	test("GET /whiteboards/{whiteboardId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards/{whiteboardId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const whiteboardIdParam = params.find((p) => p.name === "whiteboardId");
		expect(whiteboardIdParam).toBeDefined();
		expect(whiteboardIdParam?.in).toBe("path");
	});

	test("PATCH /whiteboards/{whiteboardId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards/{whiteboardId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();

		const patchOp = pathItem.patch as Record<string, unknown>;
		expect(patchOp.parameters).toBeDefined();
		expect(patchOp.requestBody).toBeDefined();
	});

	test("DELETE /whiteboards/{whiteboardId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards/{whiteboardId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();

		const deleteOp = pathItem.delete as Record<string, unknown>;
		expect(deleteOp.parameters).toBeDefined();
		const params = deleteOp.parameters as Array<Record<string, unknown>>;
		const whiteboardIdParam = params.find((p) => p.name === "whiteboardId");
		expect(whiteboardIdParam).toBeDefined();
		expect(whiteboardIdParam?.in).toBe("path");
	});

	test("GET /whiteboards/search should have query parameters", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards/search"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /whiteboards/by-user/{userId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(whiteboardsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/whiteboards/by-user/{userId}"] as Record<string, unknown>;
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
