import { describe, expect, test } from "bun:test";
import { getLatestVersion } from "../api/version-management";
import {
	getCronJobs,
	getCronJobHistory,
	getPendingJobsByQueue,
} from "../api/cron-jobs-management";
import { createOpenApiGenerator } from "../../../orpc/openapi-handler";

const versionApiRouter = {
	version: {
		getLatest: getLatestVersion,
	},
};

const cronJobsApiRouter = {
	cronJobs: {
		getAll: getCronJobs,
		getHistory: getCronJobHistory,
		getPendingByQueue: getPendingJobsByQueue,
	},
};

describe("Version API OpenAPI generation", () => {
	test("should include version path in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(versionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/version/latest"]).toBeDefined();
	});

	test("GET /version/latest should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(versionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/version/latest"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});
});

describe("Cron Jobs API OpenAPI generation", () => {
	test("should include cron-jobs paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(cronJobsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/cron-jobs"]).toBeDefined();
		expect(paths["/cron-jobs/history"]).toBeDefined();
		expect(paths["/cron-jobs/pending/{queue}"]).toBeDefined();
	});

	test("GET /cron-jobs should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(cronJobsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/cron-jobs"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /cron-jobs/history should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(cronJobsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/cron-jobs/history"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /cron-jobs/pending/{queue} should have get method and queue path param", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(cronJobsApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/cron-jobs/pending/{queue}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const queueParam = params.find((p) => p.name === "queue");
		expect(queueParam).toBeDefined();
		expect(queueParam?.in).toBe("path");
	});
});
