import { describe, expect, test } from "bun:test";
import {
	createEnrollment,
	updateEnrollment,
	findEnrollmentById,
	searchEnrollments,
	deleteEnrollment,
	findEnrollmentsByUser,
	findEnrollmentsByCourse,
	findUserEnrollmentInCourse,
	findActiveEnrollments,
	updateEnrollmentStatus,
	addGroupsToEnrollment,
	removeGroupsFromEnrollment,
	findEnrollmentsByGroup,
} from "../api/enrollment-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const enrollmentApiRouter = {
	enrollments: {
		create: createEnrollment,
		update: updateEnrollment,
		findById: findEnrollmentById,
		search: searchEnrollments,
		delete: deleteEnrollment,
		findByUser: findEnrollmentsByUser,
		findByCourse: findEnrollmentsByCourse,
		findUserEnrollmentInCourse: findUserEnrollmentInCourse,
		findActive: findActiveEnrollments,
		updateStatus: updateEnrollmentStatus,
		addGroups: addGroupsToEnrollment,
		removeGroups: removeGroupsFromEnrollment,
		findByGroup: findEnrollmentsByGroup,
	},
};

describe("Enrollment API OpenAPI generation", () => {
	test("should include enrollment paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/enrollments"]).toBeDefined();
		expect(paths["/enrollments/{enrollmentId}"]).toBeDefined();
		expect(paths["/enrollments/search"]).toBeDefined();
		expect(paths["/enrollments/by-user/{userId}"]).toBeDefined();
		expect(paths["/enrollments/by-course/{courseId}"]).toBeDefined();
		expect(paths["/enrollments/user/{userId}/course/{courseId}"]).toBeDefined();
		expect(paths["/enrollments/active"]).toBeDefined();
		expect(paths["/enrollments/{enrollmentId}/status"]).toBeDefined();
		expect(paths["/enrollments/{enrollmentId}/groups"]).toBeDefined();
		expect(paths["/enrollments/by-group/{groupId}"]).toBeDefined();
	});

	test("POST /enrollments should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("GET /enrollments/{enrollmentId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const enrollmentIdParam = params.find((p) => p.name === "enrollmentId");
		expect(enrollmentIdParam).toBeDefined();
		expect(enrollmentIdParam?.in).toBe("path");
	});

	test("PATCH /enrollments/{enrollmentId} should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});

	test("DELETE /enrollments/{enrollmentId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});

	test("GET /enrollments/search should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/search"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("GET /enrollments/by-user/{userId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/by-user/{userId}"
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

	test("GET /enrollments/by-course/{courseId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/by-course/{courseId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const courseIdParam = params.find((p) => p.name === "courseId");
		expect(courseIdParam).toBeDefined();
		expect(courseIdParam?.in).toBe("path");
	});

	test("GET /enrollments/user/{userId}/course/{courseId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/user/{userId}/course/{courseId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const userIdParam = params.find((p) => p.name === "userId");
		expect(userIdParam).toBeDefined();
		expect(userIdParam?.in).toBe("path");
		const courseIdParam = params.find((p) => p.name === "courseId");
		expect(courseIdParam).toBeDefined();
		expect(courseIdParam?.in).toBe("path");
	});

	test("GET /enrollments/active should have get method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/active"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});

	test("PATCH /enrollments/{enrollmentId}/status should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}/status"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});

	test("POST /enrollments/{enrollmentId}/groups should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}/groups"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("DELETE /enrollments/{enrollmentId}/groups should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/{enrollmentId}/groups"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});

	test("GET /enrollments/by-group/{groupId} should have correct path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(enrollmentApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/enrollments/by-group/{groupId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const groupIdParam = params.find((p) => p.name === "groupId");
		expect(groupIdParam).toBeDefined();
		expect(groupIdParam?.in).toBe("path");
	});
});
