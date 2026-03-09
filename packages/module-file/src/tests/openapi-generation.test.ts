import { describe, expect, test } from "bun:test";
import {
	createFile,
	updateFile,
	findFileById,
	searchFiles,
	deleteFile,
	findFilesByUser,
} from "../api/file-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const filesApiRouter = {
	files: {
		create: createFile,
		update: updateFile,
		findById: findFileById,
		search: searchFiles,
		delete: deleteFile,
		findByUser: findFilesByUser,
	},
};

describe("Files API OpenAPI generation", () => {
	test("should include all file paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/files"]).toBeDefined();
		expect(paths["/files/{fileId}"]).toBeDefined();
		expect(paths["/files/search"]).toBeDefined();
		expect(paths["/files/by-user/{userId}"]).toBeDefined();
	});

	test("POST /files should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();

		const postOp = pathItem.post as Record<string, unknown>;
		expect(postOp.requestBody).toBeDefined();
	});

	test("GET /files/{fileId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files/{fileId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const fileIdParam = params.find((p) => p.name === "fileId");
		expect(fileIdParam).toBeDefined();
		expect(fileIdParam?.in).toBe("path");
	});

	test("PATCH /files/{fileId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files/{fileId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();

		const patchOp = pathItem.patch as Record<string, unknown>;
		expect(patchOp.parameters).toBeDefined();
		expect(patchOp.requestBody).toBeDefined();
	});

	test("DELETE /files/{fileId} should have correct method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files/{fileId}"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();

		const deleteOp = pathItem.delete as Record<string, unknown>;
		expect(deleteOp.parameters).toBeDefined();
		const params = deleteOp.parameters as Array<Record<string, unknown>>;
		const fileIdParam = params.find((p) => p.name === "fileId");
		expect(fileIdParam).toBeDefined();
		expect(fileIdParam?.in).toBe("path");
	});

	test("GET /files/search should have query parameters", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files/search"] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /files/by-user/{userId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(filesApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)["/files/by-user/{userId}"] as Record<string, unknown>;
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
