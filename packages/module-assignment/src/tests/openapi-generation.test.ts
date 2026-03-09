import { describe, expect, test } from "bun:test";
import * as api from "../api/assignment-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const assignmentApiRouter = {
	assignments: {
		create: api.createAssignment,
		update: api.updateAssignment,
		findById: api.findAssignmentById,
		listByCourse: api.listAssignmentsByCourse,
		delete: api.deleteAssignment,
	},
	submissions: {
		submit: api.submitAssignment,
		grade: api.gradeSubmission,
		list: api.listSubmissions,
		findById: api.findSubmissionById,
		delete: api.deleteSubmission,
	},
};

describe("Assignment API OpenAPI generation", () => {
	test("should include assignment paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Assignment Module API", version: "0.1.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.info.title).toBe("Assignment Module API");
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/assignments"]).toBeDefined();
		expect(paths["/assignments/{assignmentId}"]).toBeDefined();
		expect(paths["/assignments/by-course/{courseId}"]).toBeDefined();
		expect(paths["/assignment-submissions"]).toBeDefined();
		expect(paths["/assignment-submissions/{submissionId}"]).toBeDefined();
		expect(paths["/assignment-submissions/{submissionId}/grade"]).toBeDefined();
	});

	test("POST /assignments should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignments"]?.["post"]).toBeDefined();
	});

	test("PATCH /assignments/{assignmentId} should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignments/{assignmentId}"]?.["patch"]).toBeDefined();
	});

	test("GET /assignments/{assignmentId} should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignments/{assignmentId}"]?.["get"]).toBeDefined();
	});

	test("DELETE /assignments/{assignmentId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignments/{assignmentId}"]?.["delete"]).toBeDefined();
	});

	test("POST /assignment-submissions should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignment-submissions"]?.["post"]).toBeDefined();
	});

	test("PATCH /assignment-submissions/{submissionId}/grade should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignment-submissions/{submissionId}/grade"]?.["patch"]).toBeDefined();
	});

	test("GET /assignment-submissions should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignment-submissions"]?.["get"]).toBeDefined();
	});

	test("GET /assignment-submissions/{submissionId} should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignment-submissions/{submissionId}"]?.["get"]).toBeDefined();
	});

	test("DELETE /assignment-submissions/{submissionId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(assignmentApiRouter, {
			info: { title: "Test", version: "0.1.0" },
		});
		const paths = spec.paths as Record<string, Record<string, unknown>>;
		expect(paths["/assignment-submissions/{submissionId}"]?.["delete"]).toBeDefined();
	});
});
