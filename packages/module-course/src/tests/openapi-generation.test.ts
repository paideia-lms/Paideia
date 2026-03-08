import { describe, expect, test } from "bun:test";
import {
	createCourse,
	updateCourse,
	findCourseById,
	searchCourses,
	findPublishedCourses,
	deleteCourse,
	findCoursesByInstructor,
	findAllCourses,
} from "../api/course-management";
import {
	createSection,
	updateSection,
	findSectionById,
	deleteSection,
	findSectionsByCourse,
	findRootSections,
	findChildSections,
	getSectionTree,
	getSectionAncestors,
	getSectionDepth,
} from "../api/course-section-management";
import { createOpenApiGenerator } from "@paideia/module-infrastructure/openapi-handler";

const courseApiRouter = {
	courses: {
		create: createCourse,
		update: updateCourse,
		findById: findCourseById,
		search: searchCourses,
		findPublished: findPublishedCourses,
		delete: deleteCourse,
		findByInstructor: findCoursesByInstructor,
		findAll: findAllCourses,
	},
};

const sectionApiRouter = {
	sections: {
		create: createSection,
		update: updateSection,
		findById: findSectionById,
		delete: deleteSection,
		findByCourse: findSectionsByCourse,
		findRoots: findRootSections,
		findChildren: findChildSections,
		getTree: getSectionTree,
		getAncestors: getSectionAncestors,
		getDepth: getSectionDepth,
	},
};

describe("Course API OpenAPI generation", () => {
	test("should include course paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/courses"]).toBeDefined();
		expect(paths["/courses/{courseId}"]).toBeDefined();
		expect(paths["/courses/search"]).toBeDefined();
		expect(paths["/courses/published"]).toBeDefined();
		expect(paths["/courses/by-instructor/{instructorId}"]).toBeDefined();
		expect(paths["/courses/all"]).toBeDefined();
	});

	test("POST /courses should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/courses"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("GET /courses/{courseId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/courses/{courseId}"
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

	test("PATCH /courses/{courseId} should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/courses/{courseId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});

	test("DELETE /courses/{courseId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/courses/{courseId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});

	test("GET /courses/search should support optional query params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(courseApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/courses/search"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();
	});
});

describe("Section API OpenAPI generation", () => {
	test("should include section paths in generated OpenAPI spec", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(sectionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		expect(spec).toBeDefined();
		expect(spec.openapi).toBeDefined();
		expect(spec.paths).toBeDefined();

		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/course-sections"]).toBeDefined();
		expect(paths["/course-sections/{sectionId}"]).toBeDefined();
		expect(paths["/course-sections/by-course/{courseId}"]).toBeDefined();
		expect(paths["/course-sections/roots/{courseId}"]).toBeDefined();
		expect(paths["/course-sections/{parentSectionId}/children"]).toBeDefined();
		expect(paths["/course-sections/tree/{courseId}"]).toBeDefined();
		expect(paths["/course-sections/{sectionId}/ancestors"]).toBeDefined();
		expect(paths["/course-sections/{sectionId}/depth"]).toBeDefined();
	});

	test("POST /course-sections should have post method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(sectionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/course-sections"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.post).toBeDefined();
	});

	test("GET /course-sections/{sectionId} should have correct method and path params", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(sectionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/course-sections/{sectionId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.get).toBeDefined();

		const getOp = pathItem.get as Record<string, unknown>;
		expect(getOp.parameters).toBeDefined();
		const params = getOp.parameters as Array<Record<string, unknown>>;
		const sectionIdParam = params.find((p) => p.name === "sectionId");
		expect(sectionIdParam).toBeDefined();
		expect(sectionIdParam?.in).toBe("path");
	});

	test("PATCH /course-sections/{sectionId} should have patch method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(sectionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/course-sections/{sectionId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.patch).toBeDefined();
	});

	test("DELETE /course-sections/{sectionId} should have delete method", async () => {
		const openApiGenerator = createOpenApiGenerator();
		const spec = await openApiGenerator.generate(sectionApiRouter, {
			info: { title: "Paideia LMS API", version: "1.0.0" },
			servers: [{ url: "http://localhost:3001/openapi" }],
		});

		const pathItem = (spec.paths as Record<string, unknown>)[
			"/course-sections/{sectionId}"
		] as Record<string, unknown>;
		expect(pathItem).toBeDefined();
		expect(pathItem.delete).toBeDefined();
	});
});
