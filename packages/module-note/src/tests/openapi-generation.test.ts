import { describe, expect, test } from "bun:test";
import {
	createNote,
	updateNote,
	findNoteById,
	searchNotes,
	deleteNote,
	findNotesByUser,
	generateNoteHeatmap,
} from "../api/note-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const noteApiRouter = {
	notes: {
		create: createNote,
		update: updateNote,
		findById: findNoteById,
		search: searchNotes,
		delete: deleteNote,
		findByUser: findNotesByUser,
		generateHeatmap: generateNoteHeatmap,
	},
};

describe("Note API OpenAPI generation", () => {
	test("should include note paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/notes"]).toBeDefined();
		expect(paths["/notes/{noteId}"]).toBeDefined();
		expect(paths["/notes/search"]).toBeDefined();
		expect(paths["/notes/by-user/{userId}"]).toBeDefined();
		expect(paths["/notes/heatmap/{userId}"]).toBeDefined();
	});

	test("GET /notes/{noteId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/{noteId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const noteIdParam = params.find((p) => p.name === "noteId");
		expect(noteIdParam).toBeDefined();
		expect(noteIdParam?.in).toBe("path");
	});

	test("POST /notes should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("PATCH /notes/{noteId} should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/{noteId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});

	test("DELETE /notes/{noteId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/{noteId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});

	test("GET /notes/search should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/search"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /notes/by-user/{userId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/by-user/{userId}"
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

	test("GET /notes/heatmap/{userId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(noteApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/notes/heatmap/{userId}"
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
});
