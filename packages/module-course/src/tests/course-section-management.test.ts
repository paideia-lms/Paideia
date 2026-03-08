import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import { Migration } from "payload";
import sanitizedConfig from "payload.config";
import type { CourseSection } from "payload-types";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { CourseModule } from "../index";
import { tryCreateCourse } from "../services/course-management";
import {
	tryCreateSection,
	tryDeleteSection,
	tryFindChildSections,
	tryFindRootSections,
	tryFindSectionsByCourse,
	tryGeneralMove,
	tryGetSectionAncestors,
	tryGetSectionDepth,
	tryGetSectionTree,
	tryMoveSection,
	tryNestSection,
	tryReorderSection,
	tryReorderSections,
	tryUnnestSection,
	tryUpdateSection,
	tryValidateNoCircularReference,
} from "../services/course-section-management";
import type { SectionTreeNode } from "../services/course-section-management";
import {
	courseSectionManagementTestUserSeedData,
	courseSectionManagementTestCourseSeedData,
} from "../seeding/course-section-management-test-seed-data";
import { migrations } from "src/migrations";

function generateSectionTreeString(
	tree: SectionTreeNode[],
	indent = "",
): string {
	return tree
		.map((node) => {
			let result = `${indent}${node.title}\n`;
			if (node.childSections.length > 0) {
				result += generateSectionTreeString(
					node.childSections,
					indent + "  ",
				);
			}
			return result;
		})
		.join("");
}

describe("Course Section Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let testUser: { id: number };
	let testCourse: { id: number };

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: courseSectionManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const coursesResult = (
			await courseModule.seedCourses({
				data: courseSectionManagementTestCourseSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const userEntry = usersResult.byEmail.get("testuser@example.com")!;
		testUser = userEntry.user;
		testCourse = coursesResult.getCourseBySlug("test-course")!;
	});

	afterAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();
	});

	test("should create a nested section with valid parent", async () => {
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Chapter 1",
				description: "First chapter",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section 1.1",
				description: "First section of chapter 1",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (childResult.ok) {
			expect(childResult.value.title).toBe("Section 1.1");
			expect(childResult.value.parentSection).toBe(parentResult.value.id);
		}
	});

	test("should create deeply nested sections (3+ levels)", async () => {
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Advanced Topics",
				description: "Advanced course topics",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		const level2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Topic A",
				description: "First advanced topic",
				parentSection: rootResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level2Result.ok).toBe(true);
		if (!level2Result.ok) return;

		const level3Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Sub-topic A.1",
				description: "First sub-topic",
				parentSection: level2Result.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level3Result.ok).toBe(true);
		if (level3Result.ok) {
			expect(level3Result.value.title).toBe("Sub-topic A.1");
			expect(level3Result.value.parentSection).toBe(level2Result.value.id);
		}
	});

	test("should prevent circular reference when creating section", async () => {
		const result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Self Reference Test",
				description: "Testing self reference",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updateResult = await tryUpdateSection({
			payload,
			sectionId: result.value.id,
			data: {
				parentSection: result.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toMatch(
				/own parent|Failed to update section/,
			);
		}
	});

	test("should prevent circular reference when updating parent", async () => {
		const grandparentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Grandparent",
				description: "Grandparent section",
			},
			overrideAccess: true,
			req: undefined,
		});
		expect(grandparentResult.ok).toBe(true);
		if (!grandparentResult.ok) return;

		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent",
				description: "Parent section",
				parentSection: grandparentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});
		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child",
				description: "Child section",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});
		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const updateResult = await tryUpdateSection({
			payload,
			sectionId: grandparentResult.value.id,
			data: {
				parentSection: childResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toMatch(
				/circular reference|Failed to update section/,
			);
		}
	});

	test("should update section properties (title, description, order)", async () => {
		const createResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Original Title",
				description: "Original description",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const updateResult = await tryUpdateSection({
			payload,
			sectionId: createResult.value.id,
			data: {
				title: "Updated Title",
				description: "Updated description",
				contentOrder: 5,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.title).toBe("Updated Title");
			expect(updateResult.value.description).toBe("Updated description");
			expect(updateResult.value.contentOrder).toBe(5);
		}
	});

	test("should delete section without children or modules", async () => {
		const createResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "To Be Deleted",
				description: "This section will be deleted",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: createResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(deleteResult.ok).toBe(true);
	});

	test("should prevent delete section with child sections", async () => {
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent Section",
				description: "Parent with children",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child Section",
				description: "Child of parent",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: parentResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/child sections|Failed to delete section/,
			);
		}
	});

	test("should find sections by course", async () => {
		const result = await tryFindSectionsByCourse({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			expect(result.value.length).toBeGreaterThan(0);
		}
	});

	test("should find root sections", async () => {
		const result = await tryFindRootSections({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			for (const section of result.value) {
				expect(section.parentSection).toBeNull();
			}
		}
	});

	test("should find child sections", async () => {
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent for Children",
				description: "Parent section",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const child1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child 1",
				description: "First child",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		const child2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child 2",
				description: "Second child",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(child1Result.ok).toBe(true);
		expect(child2Result.ok).toBe(true);

		const result = await tryFindChildSections({
			payload,
			parentSectionId: parentResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBe(2);
			for (const child of result.value) {
				expect(
					typeof child.parentSection === "number"
						? child.parentSection
						: child.parentSection?.id,
				).toBe(parentResult.value.id);
			}
		}
	});

	test("should get section tree structure", async () => {
		const result = await tryGetSectionTree({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			for (const rootSection of result.value) {
				expect(rootSection.parentSection).toBeNull();
				expect(Array.isArray(rootSection.childSections)).toBe(true);
			}
		}
	});

	test("should get section ancestors", async () => {
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Root Ancestor",
				description: "Root section",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child Ancestor",
				description: "Child section",
				parentSection: rootResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const grandchildResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Grandchild",
				description: "Grandchild section",
				parentSection: childResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(grandchildResult.ok).toBe(true);
		if (!grandchildResult.ok) return;

		const result = await tryGetSectionAncestors({
			payload,
			sectionId: grandchildResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBe(3);
			expect(result.value[0]!.title).toBe("Root Ancestor");
			expect(result.value[1]!.title).toBe("Child Ancestor");
			expect(result.value[2]!.title).toBe("Grandchild");
		}
	});

	test("should calculate section depth", async () => {
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Depth Root",
				description: "Root for depth test",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Depth Child",
				description: "Child for depth test",
				parentSection: rootResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const rootDepthResult = await tryGetSectionDepth({
			payload,
			sectionId: rootResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		const childDepthResult = await tryGetSectionDepth({
			payload,
			sectionId: childResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(rootDepthResult.ok).toBe(true);
		expect(childDepthResult.ok).toBe(true);

		if (rootDepthResult.ok && childDepthResult.ok) {
			expect(rootDepthResult.value).toBe(0);
			expect(childDepthResult.value).toBe(1);
		}
	});

	test("should reorder single section", async () => {
		const section1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section 1",
				description: "First section",
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		const section2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section 2",
				description: "Second section",
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(section1Result.ok).toBe(true);
		expect(section2Result.ok).toBe(true);

		if (!section1Result.ok || !section2Result.ok) return;

		const reorderResult = await tryReorderSection({
			payload,
			sectionId: section1Result.value.id,
			newContentOrder: 2,
			overrideAccess: true,
			req: undefined,
		});

		expect(reorderResult.ok).toBe(true);
		if (reorderResult.ok) {
			expect(reorderResult.value.contentOrder).toBe(2);
		}
	});

	test("should reorder multiple sections in batch", async () => {
		const sections = [];
		for (let i = 1; i <= 3; i++) {
			const result = await tryCreateSection({
				payload,
				data: {
					course: testCourse.id,
					title: `Batch Section ${i}`,
					description: `Section ${i} for batch reorder`,
					contentOrder: i,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				sections.push(result.value);
			}
		}

		const sectionIds = sections.map((s) => s.id).reverse();
		const reorderResult = await tryReorderSections({
			payload,
			sectionIds,
			overrideAccess: true,
			req: undefined,
		});

		expect(reorderResult.ok).toBe(true);
		if (reorderResult.ok) {
			expect(reorderResult.value.success).toBe(true);
			expect(reorderResult.value.reorderedCount).toBe(3);
		}
	});

	test("should nest section under parent", async () => {
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Root for Nesting",
				description: "Root section",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "To Be Nested",
				description: "Section to be nested",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		const nestResult = await tryNestSection({
			payload,
			sectionId: sectionResult.value.id,
			newParentSectionId: rootResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(nestResult.ok).toBe(true);
		if (nestResult.ok) {
			expect(
				typeof nestResult.value.parentSection === "number"
					? nestResult.value.parentSection
					: nestResult.value.parentSection?.id,
			).toBe(rootResult.value.id);
		}
	});

	test("should unnest section to root", async () => {
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent for Unnesting",
				description: "Parent section",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child to Unnest",
				description: "Child section",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const unnestResult = await tryUnnestSection({
			payload,
			sectionId: childResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(unnestResult.ok).toBe(true);
		if (unnestResult.ok) {
			expect(unnestResult.value.parentSection).toBeNull();
		}
	});

	test("should move section between parents", async () => {
		const parent1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent 1",
				description: "First parent",
			},
			overrideAccess: true,
			req: undefined,
		});

		const parent2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent 2",
				description: "Second parent",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(parent1Result.ok).toBe(true);
		expect(parent2Result.ok).toBe(true);

		if (!parent1Result.ok || !parent2Result.ok) return;

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Movable Child",
				description: "Child to be moved",
				parentSection: parent1Result.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const moveResult = await tryMoveSection({
			payload,
			sectionId: childResult.value.id,
			newParentSectionId: parent2Result.value.id,
			newOrder: 1,
			overrideAccess: true,
			req: undefined,
		});

		expect(moveResult.ok).toBe(true);
		if (moveResult.ok) {
			expect(
				typeof moveResult.value.parentSection === "number"
					? moveResult.value.parentSection
					: moveResult.value.parentSection?.id,
			).toBe(parent2Result.value.id);
			expect(moveResult.value.contentOrder).toBe(0);
		}
	});

	test("should validate no circular reference", async () => {
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Validation Root",
				description: "Root for validation",
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) throw new Error("Failed to create root section");

		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Validation Child",
				description: "Child for validation",
				parentSection: rootResult.value.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(rootResult.ok).toBe(true);
		expect(childResult.ok).toBe(true);

		if (!rootResult.ok || !childResult.ok) return;

		const validResult = await tryValidateNoCircularReference({
			payload,
			sectionId: childResult.value.id,
			newParentSectionId: rootResult.value.id,
			req: undefined,
		});

		expect(validResult.ok).toBe(true);
		if (validResult.ok) {
			expect(validResult.value).toBe(true);
		}

		const invalidResult = await tryValidateNoCircularReference({
			payload,
			sectionId: rootResult.value.id,
			newParentSectionId: childResult.value.id,
			req: undefined,
		});

		expect(invalidResult.ok).toBe(true);
		if (invalidResult.ok) {
			expect(invalidResult.value).toBe(false);
		}
	});

	test("should get section tree with nested sections", async () => {
		const structureTestCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Structure Test Course",
				description: "A course for testing structure representation",
				slug: "structure-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(structureTestCourseResult.ok).toBe(true);
		if (!structureTestCourseResult.ok) return;

		const structureTestCourse = structureTestCourseResult.value;

		const introResult = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Introduction",
				description: "Course introduction",
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(introResult.ok).toBe(true);
		if (!introResult.ok) return;

		const mainResult = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Main Content",
				description: "Main course content",
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;

		const chapter1Result = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Chapter 1",
				description: "First chapter",
				parentSection: mainResult.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(chapter1Result.ok).toBe(true);
		if (!chapter1Result.ok) return;

		const chapter2Result = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Chapter 2",
				description: "Second chapter",
				parentSection: mainResult.value.id,
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(chapter2Result.ok).toBe(true);
		if (!chapter2Result.ok) return;

		const section11Result = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Section 1.1",
				description: "First section of chapter 1",
				parentSection: chapter1Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(section11Result.ok).toBe(true);
		if (!section11Result.ok) return;

		const structureResult = await tryGetSectionTree({
			payload,
			courseId: structureTestCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const tree = structureResult.value;
		expect(Array.isArray(tree)).toBe(true);
		expect(tree.length).toBeGreaterThanOrEqual(2);

		const introSection = tree.find((s) => s.title === "Introduction");
		const mainContentSection = tree.find((s) => s.title === "Main Content");

		expect(introSection).toBeDefined();
		expect(mainContentSection).toBeDefined();

		if (introSection && mainContentSection) {
			expect(introSection.contentOrder).toBeLessThan(
				mainContentSection.contentOrder,
			);
			expect(mainContentSection.childSections.length).toBe(2);

			const chapter1 = mainContentSection.childSections.find(
				(s) => s.title === "Chapter 1",
			);
			const chapter2 = mainContentSection.childSections.find(
				(s) => s.title === "Chapter 2",
			);
			expect(chapter1).toBeDefined();
			expect(chapter2).toBeDefined();

			if (chapter1) {
				expect(chapter1.childSections.length).toBe(1);
				expect(chapter1.childSections[0]!.title).toBe("Section 1.1");
			}
		}
	});

	test("should get section tree with empty course", async () => {
		const emptyCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Empty Course",
				description: "A course with no sections",
				slug: "empty-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(emptyCourseResult.ok).toBe(true);
		if (!emptyCourseResult.ok) return;

		const structureResult = await tryGetSectionTree({
			payload,
			courseId: emptyCourseResult.value.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const structure = structureResult.value;
		expect(Array.isArray(structure)).toBe(true);
		expect(structure.length).toBe(1); // Default "Course Content" section
	});

	test("should generate tree representation from section tree", async () => {
		const treeTestCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Tree Test Course",
				description: "A course for testing tree generation",
				slug: "tree-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(treeTestCourseResult.ok).toBe(true);
		if (!treeTestCourseResult.ok) return;

		const treeTestCourse = treeTestCourseResult.value;

		const introResult = await tryCreateSection({
			payload,
			data: {
				course: treeTestCourse.id,
				title: "Introduction",
				description: "Course introduction",
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		const mainResult = await tryCreateSection({
			payload,
			data: {
				course: treeTestCourse.id,
				title: "Main Content",
				description: "Main course content",
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(introResult.ok).toBe(true);
		expect(mainResult.ok).toBe(true);
		if (!introResult.ok || !mainResult.ok) return;

		const chapter1Result = await tryCreateSection({
			payload,
			data: {
				course: treeTestCourse.id,
				title: "Chapter 1",
				description: "First chapter",
				parentSection: mainResult.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(chapter1Result.ok).toBe(true);
		if (!chapter1Result.ok) return;

		const structureResult = await tryGetSectionTree({
			payload,
			courseId: treeTestCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const sections = structureResult.value;
		const tree = generateSectionTreeString(sections, "");

		expect(tree).toContain("Introduction");
		expect(tree).toContain("Main Content");
		expect(tree).toContain("Chapter 1");
	});

	test("should prevent delete last section in course", async () => {
		const newCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Single Section Course",
				description: "A course with only one section",
				slug: "single-section-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(newCourseResult.ok).toBe(true);
		if (!newCourseResult.ok) return;

		const newCourse = newCourseResult.value;

		const sectionsResult = await tryFindSectionsByCourse({
			payload,
			courseId: newCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(sectionsResult.ok).toBe(true);
		if (!sectionsResult.ok) return;

		expect(sectionsResult.value.length).toBe(1);
		const defaultSection = sectionsResult.value[0]!;

		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: defaultSection.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/Cannot delete the last section in a course/,
			);
		}
	});

	test("should allow delete section when course has multiple sections", async () => {
		const newCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Multi Section Course",
				description: "A course with multiple sections",
				slug: "multi-section-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(newCourseResult.ok).toBe(true);
		if (!newCourseResult.ok) return;

		const newCourse = newCourseResult.value;

		const secondSectionResult = await tryCreateSection({
			payload,
			data: {
				course: newCourse.id,
				title: "Second Section",
				description: "Another section in the course",
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(secondSectionResult.ok).toBe(true);
		if (!secondSectionResult.ok) return;

		const sectionsResult = await tryFindSectionsByCourse({
			payload,
			courseId: newCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(sectionsResult.ok).toBe(true);
		if (!sectionsResult.ok) return;

		expect(sectionsResult.value.length).toBe(2);
		const defaultSection = sectionsResult.value[0]!;

		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: defaultSection.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(deleteResult.ok).toBe(true);
	});

	// TODO: broken for now 
	test.skip("tryGeneralMove - section move scenarios", async () => {
		const complexCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "General Move Test Course",
				description: "Course for testing general move functionality",
				slug: "general-move-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
			req: undefined,
		});

		if (!complexCourseResult.ok) {
			throw new Error("Failed to create complex test course");
		}

		const complexCourse = complexCourseResult.value;

		const rootSection1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Root Section 1",
				description: "First root section",
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		const rootSection2Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Root Section 2",
				description: "Second root section",
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		if (!rootSection1Result.ok || !rootSection2Result.ok) {
			throw new Error("Failed to create root sections");
		}

		const rootSection1 = rootSection1Result.value;
		const rootSection2 = rootSection2Result.value;

		const childSection1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Child Section 1",
				description: "First child section",
				parentSection: rootSection1.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		const childSection2Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Child Section 2",
				description: "Second child section",
				parentSection: rootSection1.id,
				contentOrder: 2,
			},
			overrideAccess: true,
			req: undefined,
		});

		if (!childSection1Result.ok || !childSection2Result.ok) {
			throw new Error("Failed to create child sections");
		}

		const childSection1 = childSection1Result.value;
		const childSection2 = childSection2Result.value;

		// Test 1: Move section above another section
		const moveAboveResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "above",
			overrideAccess: true,
			req: undefined,
		});

		expect(moveAboveResult.ok).toBe(true);
		if (moveAboveResult.ok) {
			const updatedSection = moveAboveResult.value as CourseSection;
			expect(updatedSection.contentOrder).toBe(1);
		}

		// Test 2: Move section below another section
		const moveBelowResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "below",
			overrideAccess: true,
			req: undefined,
		});

		expect(moveBelowResult.ok).toBe(true);
		if (moveBelowResult.ok) {
			const updatedSection = moveBelowResult.value as CourseSection;
			expect(updatedSection.contentOrder).toBe(2);
		}

		// Test 3: Move section inside another section
		const moveInsideResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: rootSection2.id, type: "section" },
			location: "inside",
			overrideAccess: true,
			req: undefined,
		});

		expect(moveInsideResult.ok).toBe(true);
		if (moveInsideResult.ok) {
			const updatedSection = moveInsideResult.value as CourseSection;
			const parentId =
				typeof updatedSection.parentSection === "number"
					? updatedSection.parentSection
					: updatedSection.parentSection?.id;
			expect(parentId).toBe(rootSection2.id);
		}

		// Test 4: Error case - circular reference
		const circularRefResult = await tryGeneralMove({
			payload,
			source: { id: rootSection1.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "inside",
			overrideAccess: true,
			req: undefined,
		});

		expect(circularRefResult.ok).toBe(false);
		if (!circularRefResult.ok) {
			expect(circularRefResult.error.message).toContain("circular reference");
		}

		// Test 5: Verify final structure
		const finalStructureResult = await tryGetSectionTree({
			payload,
			courseId: complexCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(finalStructureResult.ok).toBe(true);
	});

	test("should handle section tree with deeply nested sections", async () => {
		const level1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Level 1",
				description: "First level",
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level1Result.ok).toBe(true);
		if (!level1Result.ok) return;

		const level2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Level 2",
				description: "Second level",
				parentSection: level1Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level2Result.ok).toBe(true);
		if (!level2Result.ok) return;

		const level3Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Level 3",
				description: "Third level",
				parentSection: level2Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level3Result.ok).toBe(true);
		if (!level3Result.ok) return;

		const level4Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Level 4",
				description: "Fourth level",
				parentSection: level3Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
			req: undefined,
		});

		expect(level4Result.ok).toBe(true);
		if (!level4Result.ok) return;

		const structureResult = await tryGetSectionTree({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
			req: undefined,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const sections = structureResult.value;
		const level1 = sections.find((s) => s.title === "Level 1");
		expect(level1).toBeDefined();

		if (level1) {
			expect(level1.childSections.length).toBe(1);
			const level2 = level1.childSections[0]!;
			expect(level2.title).toBe("Level 2");
			expect(level2.childSections.length).toBe(1);
			const level3 = level2.childSections[0]!;
			expect(level3.title).toBe("Level 3");
			expect(level3.childSections.length).toBe(1);
			const level4 = level3.childSections[0]!;
			expect(level4.title).toBe("Level 4");
			expect(level4.childSections.length).toBe(0);
		}
	});
});
