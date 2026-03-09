import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, type Migration } from "payload";
import sanitizedConfig from "payload.config";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { migrations } from "src/migrations";

describe("Groups Collection beforeValidate Hook", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const infrastructureModule = new InfrastructureModule(payload);
	let testUserId: number;
	let testCourseId: number;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const testUser = await payload.create({
			collection: "users",
			data: {
				email: "test-groups@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				theme: "light",
				direction: "ltr",
			},
			overrideAccess: true,
		});
		testUserId = testUser.id;

		const testCourse = await payload.create({
			collection: "courses",
			data: {
				title: "Test Course for Groups",
				description: "A test course for groups testing",
				createdBy: testUserId,
				slug: "test-course-groups",
				status: "published",
			},
			overrideAccess: true,
		});
		testCourseId = testCourse.id;
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should auto-generate path for root level group", async () => {
		const group = await payload.create({
			collection: "groups",
			data: {
				name: "root-group",
				course: testCourseId,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(group.path).toBe("root-group");
	});

	test("should auto-generate path for child group based on parent", async () => {
		const parentGroup = await payload.create({
			collection: "groups",
			data: {
				name: "parent-group",
				course: testCourseId,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(parentGroup.path).toBe("parent-group");

		const childGroup = await payload.create({
			collection: "groups",
			data: {
				name: "child-group",
				course: testCourseId,
				parent: parentGroup.id,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(childGroup.path).toBe("parent-group/child-group");
	});

	test("should auto-generate path for nested child group", async () => {
		const rootGroup = await payload.create({
			collection: "groups",
			data: {
				name: "root",
				course: testCourseId,
			},
			draft: true,
			overrideAccess: true,
		});

		const level1Group = await payload.create({
			collection: "groups",
			data: {
				name: "level-1",
				course: testCourseId,
				parent: rootGroup.id,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(level1Group.path).toBe("root/level-1");

		const level2Group = await payload.create({
			collection: "groups",
			data: {
				name: "level-2",
				course: testCourseId,
				parent: level1Group.id,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(level2Group.path).toBe("root/level-1/level-2");
	});

	test("should update path when parent is added during update", async () => {
		const rootGroup = await payload.create({
			collection: "groups",
			data: {
				name: "update-test-root",
				course: testCourseId,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(rootGroup.path).toBe("update-test-root");

		const standaloneGroup = await payload.create({
			collection: "groups",
			data: {
				name: "standalone-group",
				course: testCourseId,
			},
			draft: true,
			overrideAccess: true,
		});

		expect(standaloneGroup.path).toBe("standalone-group");

		const updatedGroup = await payload.update({
			collection: "groups",
			id: standaloneGroup.id,
			data: {
				parent: rootGroup.id,
			},
			overrideAccess: true,
		});

		expect(updatedGroup.path).toBe("update-test-root/standalone-group");
	});
});
