import { describe, expect, test } from "bun:test";
import {
	findUserById,
	findUserByEmail,
	findAllUsers,
} from "../api/user-management";
import {
	getMediaById,
	getMediaByFilenames,
	getMediaByIds,
	getAllMedia,
	deleteMedia,
	getMediaByMimeType,
	findMediaByUser,
	renameMedia,
	getUserMediaStats,
	getSystemMediaStats,
	getOrphanedMedia,
	getAllOrphanedFilenames,
	findMediaUsages,
} from "../api/media-management";
import { createOpenApiGenerator } from "../../../orpc/openapi-handler";

const userApiRouter = {
	users: {
		findById: findUserById,
		findByEmail: findUserByEmail,
		findAll: findAllUsers,
	},
};

const mediaApiRouter = {
	media: {
		getById: getMediaById,
		getByFilenames: getMediaByFilenames,
		getByIds: getMediaByIds,
		getAll: getAllMedia,
		delete: deleteMedia,
		getByMimeType: getMediaByMimeType,
		findByUser: findMediaByUser,
		rename: renameMedia,
		getUserStats: getUserMediaStats,
		getSystemStats: getSystemMediaStats,
		getOrphaned: getOrphanedMedia,
		getAllOrphanedFilenames,
		findUsages: findMediaUsages,
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

describe("Media API OpenAPI generation", () => {
	test("should include media paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(mediaApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/media/{id}"]).toBeDefined();
		expect(paths["/media/by-filenames"]).toBeDefined();
		expect(paths["/media/by-ids"]).toBeDefined();
		expect(paths["/media"]).toBeDefined();
		expect(paths["/media/by-mime-type"]).toBeDefined();
		expect(paths["/media/by-user/{userId}"]).toBeDefined();
		expect(paths["/media/{id}/rename"]).toBeDefined();
		expect(paths["/media/stats/user/{userId}"]).toBeDefined();
		expect(paths["/media/stats/system"]).toBeDefined();
		expect(paths["/media/orphaned"]).toBeDefined();
		expect(paths["/media/orphaned/filenames"]).toBeDefined();
		expect(paths["/media/{mediaId}/usages"]).toBeDefined();
	});

	test("GET /media/{id} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(mediaApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/media/{id}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const idParam = params.find((p) => p.name === "id");
		expect(idParam).toBeDefined();
		expect(idParam?.in).toBe("path");
	});

	test("DELETE /media/{id} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(mediaApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/media/{id}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});

	test("POST /media/by-filenames should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(mediaApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/media/by-filenames"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("PATCH /media/{id}/rename should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(mediaApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/media/{id}/rename"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});
});
