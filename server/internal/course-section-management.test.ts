import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import type { CourseActivityModuleLink, CourseSection } from "../payload-types";
import { generateCourseStructureTree } from "../utils/course-structure-tree";
import {
	type CreateAssignmentModuleArgs,
	type CreateDiscussionModuleArgs,
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreateQuizModule,
	type CreateQuizModuleArgs,
} from "./activity-module-management";
import { tryCreateCourse } from "./course-management";
import {
	tryAddActivityModuleToSection,
	tryCreateSection,
	tryDeleteSection,
	tryFindChildSections,
	tryFindRootSections,
	tryFindSectionsByCourse,
	tryGeneralMove,
	tryGetCourseStructure,
	tryGetSectionAncestors,
	tryGetSectionDepth,
	tryGetSectionModulesCount,
	tryGetSectionTree,
	tryMoveActivityModuleBetweenSections,
	tryMoveSection,
	tryNestSection,
	tryRemoveActivityModuleFromSection,
	tryReorderActivityModulesInSection,
	tryReorderSection,
	tryReorderSections,
	tryUnnestSection,
	tryUpdateSection,
	tryValidateNoCircularReference,
} from "./course-section-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Section Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: { id: number };
	let testCourse: { id: number };
	let testActivityModule: { id: number };

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create test user
		const userArgs: CreateUserArgs = {
			payload,
			data: {
				email: "testuser@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		};

		const userResult = await tryCreateUser(userArgs);
		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUser = userResult.value;

		// Create test course
		const courseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course",
				description: "A test course for section management",
				slug: "test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		if (!courseResult.ok) {
			throw new Error("Failed to create test course");
		}

		testCourse = courseResult.value;

		// Create test activity module
		const activityModuleResult = await tryCreateAssignmentModule({
			payload,
			title: "Test Activity Module",
			description: "A test activity module",
			userId: testUser.id,
			instructions: "Test assignment instructions",
			overrideAccess: true,
		} satisfies CreateAssignmentModuleArgs);

		if (!activityModuleResult.ok) {
			throw new Error("Failed to create test activity module");
		}

		testActivityModule = activityModuleResult.value;
	});

	afterAll(async () => {
		await $`bun run migrate:fresh --force-accept-warning`;
	});

	test("should create a nested section with valid parent", async () => {
		// First create a parent section
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Chapter 1",
				description: "First chapter",
			},
			overrideAccess: true,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		// Create child section
		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section 1.1",
				description: "First section of chapter 1",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
		});

		expect(childResult.ok).toBe(true);
		if (childResult.ok) {
			expect(childResult.value.title).toBe("Section 1.1");
			expect(
				typeof childResult.value.parentSection === "number"
					? childResult.value.parentSection
					: childResult.value.parentSection?.id,
			).toBe(parentResult.value.id);
		}
	});

	test("should create deeply nested sections (3+ levels)", async () => {
		// Create root section
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Advanced Topics",
				description: "Advanced course topics",
			},
			overrideAccess: true,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		// Create level 2 section
		const level2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Topic A",
				description: "First advanced topic",
				parentSection: rootResult.value.id,
			},
			overrideAccess: true,
		});

		expect(level2Result.ok).toBe(true);
		if (!level2Result.ok) return;

		// Create level 3 section
		const level3Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Sub-topic A.1",
				description: "First sub-topic",
				parentSection: level2Result.value.id,
			},
			overrideAccess: true,
		});

		expect(level3Result.ok).toBe(true);
		if (level3Result.ok) {
			expect(level3Result.value.title).toBe("Sub-topic A.1");
			expect(
				typeof level3Result.value.parentSection === "number"
					? level3Result.value.parentSection
					: level3Result.value.parentSection?.id,
			).toBe(level2Result.value.id);
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
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Try to update the section to be its own parent
		const updateResult = await tryUpdateSection({
			payload,
			sectionId: result.value.id,
			data: {
				parentSection: result.value.id,
			},
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toMatch(
				/own parent|Failed to update section/,
			);
		}
	});

	test("should prevent circular reference when updating parent", async () => {
		// Create grandparent section
		const grandparentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Grandparent",
				description: "Grandparent section",
			},
			overrideAccess: true,
		});
		expect(grandparentResult.ok).toBe(true);
		if (!grandparentResult.ok) return;

		// Create parent section
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent",
				description: "Parent section",
				parentSection: grandparentResult.value.id,
			},
			overrideAccess: true,
		});
		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		// Create child section
		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child",
				description: "Child section",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
		});
		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Try to make grandparent a child of child (circular)
		const updateResult = await tryUpdateSection({
			payload,
			sectionId: grandparentResult.value.id,
			data: {
				parentSection: childResult.value.id,
			},
			overrideAccess: true,
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
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: createResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(true);
	});

	test("should prevent delete section with child sections", async () => {
		// Create parent section
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent Section",
				description: "Parent with children",
			},
			overrideAccess: true,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		// Create child section
		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child Section",
				description: "Child of parent",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Try to delete parent section
		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: parentResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/child sections|Failed to delete section/,
			);
		}
	});

	test("should prevent delete section with activity modules", async () => {
		// Create section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section with Modules",
				description: "Section that will have modules",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Add activity module to section
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) return;

		// Try to delete section
		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/activity modules|Failed to delete section/,
			);
		}
	});

	test("should find sections by course", async () => {
		const result = await tryFindSectionsByCourse({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
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
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			// All sections should have no parent
			for (const section of result.value) {
				expect(section.parentSection).toBeNull();
			}
		}
	});

	test("should find child sections", async () => {
		// Create parent section
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent for Children",
				description: "Parent section",
			},
			overrideAccess: true,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		// Create child sections
		const child1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child 1",
				description: "First child",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
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
		});

		expect(child1Result.ok).toBe(true);
		expect(child2Result.ok).toBe(true);

		// Find child sections
		const result = await tryFindChildSections({
			payload,
			parentSectionId: parentResult.value.id,
			overrideAccess: true,
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
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			// Verify tree structure
			for (const rootSection of result.value) {
				expect(rootSection.parentSection).toBeNull();
				expect(Array.isArray(rootSection.childSections)).toBe(true);
			}
		}
	});

	test("should get section ancestors", async () => {
		// Create nested sections
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Root Ancestor",
				description: "Root section",
			},
			overrideAccess: true,
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
		});

		expect(grandchildResult.ok).toBe(true);
		if (!grandchildResult.ok) return;

		// Get ancestors
		const result = await tryGetSectionAncestors({
			payload,
			sectionId: grandchildResult.value.id,
			overrideAccess: true,
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
		// Create nested sections
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Depth Root",
				description: "Root for depth test",
			},
			overrideAccess: true,
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
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Test depths
		const rootDepthResult = await tryGetSectionDepth({
			payload,
			sectionId: rootResult.value.id,
			overrideAccess: true,
		});

		const childDepthResult = await tryGetSectionDepth({
			payload,
			sectionId: childResult.value.id,
			overrideAccess: true,
		});

		expect(rootDepthResult.ok).toBe(true);
		expect(childDepthResult.ok).toBe(true);

		if (rootDepthResult.ok && childDepthResult.ok) {
			expect(rootDepthResult.value).toBe(0); // Root should have depth 0
			expect(childDepthResult.value).toBe(1); // Child should have depth 1
		}
	});

	test("should reorder single section", async () => {
		// Create sections
		const section1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Section 1",
				description: "First section",
				contentOrder: 1,
			},
			overrideAccess: true,
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
		});

		expect(section1Result.ok).toBe(true);
		expect(section2Result.ok).toBe(true);

		if (!section1Result.ok || !section2Result.ok) return;

		// Reorder section 1 to position 2
		const reorderResult = await tryReorderSection({
			payload,
			sectionId: section1Result.value.id,
			newContentOrder: 2,
			overrideAccess: true,
		});

		expect(reorderResult.ok).toBe(true);
		if (reorderResult.ok) {
			expect(reorderResult.value.contentOrder).toBe(2);
		}
	});

	test("should reorder multiple sections in batch", async () => {
		// Create multiple sections
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
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				sections.push(result.value);
			}
		}

		// Reorder sections (reverse order)
		const sectionIds = sections.map((s) => s.id).reverse();
		const reorderResult = await tryReorderSections({
			payload,
			sectionIds,
			overrideAccess: true,
		});

		expect(reorderResult.ok).toBe(true);
		if (reorderResult.ok) {
			expect(reorderResult.value.success).toBe(true);
			expect(reorderResult.value.reorderedCount).toBe(3);
		}
	});

	test("should nest section under parent", async () => {
		// Create root section
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Root for Nesting",
				description: "Root section",
			},
			overrideAccess: true,
		});

		expect(rootResult.ok).toBe(true);
		if (!rootResult.ok) return;

		// Create section to be nested
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "To Be Nested",
				description: "Section to be nested",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Nest the section
		const nestResult = await tryNestSection({
			payload,
			sectionId: sectionResult.value.id,
			newParentSectionId: rootResult.value.id,
			overrideAccess: true,
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
		// Create parent section
		const parentResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent for Unnesting",
				description: "Parent section",
			},
			overrideAccess: true,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		// Create child section
		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Child to Unnest",
				description: "Child section",
				parentSection: parentResult.value.id,
			},
			overrideAccess: true,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Unnest the section
		const unnestResult = await tryUnnestSection({
			payload,
			sectionId: childResult.value.id,
			overrideAccess: true,
		});

		expect(unnestResult.ok).toBe(true);
		if (unnestResult.ok) {
			expect(unnestResult.value.parentSection).toBeNull();
		}
	});

	test("should move section between parents", async () => {
		// Create two parent sections
		const parent1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent 1",
				description: "First parent",
			},
			overrideAccess: true,
		});

		const parent2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Parent 2",
				description: "Second parent",
			},
			overrideAccess: true,
		});

		expect(parent1Result.ok).toBe(true);
		expect(parent2Result.ok).toBe(true);

		if (!parent1Result.ok || !parent2Result.ok) return;

		// Create child section under parent 1
		const childResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Movable Child",
				description: "Child to be moved",
				parentSection: parent1Result.value.id,
			},
			overrideAccess: true,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Move child to parent 2
		const moveResult = await tryMoveSection({
			payload,
			sectionId: childResult.value.id,
			newParentSectionId: parent2Result.value.id,
			newOrder: 1,
			overrideAccess: true,
		});

		expect(moveResult.ok).toBe(true);
		if (moveResult.ok) {
			expect(
				typeof moveResult.value.parentSection === "number"
					? moveResult.value.parentSection
					: moveResult.value.parentSection?.id,
			).toBe(parent2Result.value.id);
			expect(moveResult.value.contentOrder).toBe(0); // contentOrder should be normalized to start from 0
		}
	});

	test("should add activity module to section", async () => {
		// Create section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Module Section",
				description: "Section for modules",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Add activity module to section
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (linkResult.ok) {
			expect(
				typeof linkResult.value.section === "number"
					? linkResult.value.section
					: linkResult.value.section?.id,
			).toBe(sectionResult.value.id);
			expect(
				typeof linkResult.value.activityModule === "number"
					? linkResult.value.activityModule
					: linkResult.value.activityModule?.id,
			).toBe(testActivityModule.id);
		}
	});

	test("should remove activity module from section", async () => {
		// Create section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Removal Section",
				description: "Section for removal test",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Add activity module to section
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) return;

		// Remove the link
		const removeResult = await tryRemoveActivityModuleFromSection({
			payload,
			linkId: linkResult.value.id,
			overrideAccess: true,
		});

		expect(removeResult.ok).toBe(true);
	});

	test("should reorder activity modules within section", async () => {
		// Create section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Reorder Section",
				description: "Section for reorder test",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Create another activity module
		const activityModule2Result = await tryCreateQuizModule({
			payload,
			title: "Test Activity Module 2",
			description: "Second test activity module",
			userId: testUser.id,
			instructions: "Test quiz instructions",
			overrideAccess: true,
		} satisfies CreateQuizModuleArgs);

		expect(activityModule2Result.ok).toBe(true);
		if (!activityModule2Result.ok) return;

		// Add both modules to section
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		const link2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule2Result.value.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(link1Result.ok).toBe(true);
		expect(link2Result.ok).toBe(true);

		if (!link1Result.ok || !link2Result.ok) return;

		// Reorder modules (reverse order)
		const reorderResult = await tryReorderActivityModulesInSection({
			payload,
			sectionId: sectionResult.value.id,
			linkIds: [link2Result.value.id, link1Result.value.id],
			overrideAccess: true,
		});

		expect(reorderResult.ok).toBe(true);
		if (reorderResult.ok) {
			expect(reorderResult.value.success).toBe(true);
			expect(reorderResult.value.reorderedCount).toBe(2);
		}
	});

	test("should move activity module between sections", async () => {
		// Create two sections
		const section1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Source Section",
				description: "Source section",
			},
			overrideAccess: true,
		});

		const section2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Target Section",
				description: "Target section",
			},
			overrideAccess: true,
		});

		expect(section1Result.ok).toBe(true);
		expect(section2Result.ok).toBe(true);

		if (!section1Result.ok || !section2Result.ok) return;

		// Add module to first section
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: section1Result.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) return;

		// Move module to second section
		const moveResult = await tryMoveActivityModuleBetweenSections({
			payload,
			linkId: linkResult.value.id,
			newSectionId: section2Result.value.id,
			overrideAccess: true,
		});

		expect(moveResult.ok).toBe(true);
		if (moveResult.ok) {
			expect(
				typeof moveResult.value.section === "number"
					? moveResult.value.section
					: moveResult.value.section?.id,
			).toBe(section2Result.value.id);
		}
	});

	test("should count modules in section", async () => {
		// Create section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Count Section",
				description: "Section for counting",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Initially should have 0 modules
		const initialCountResult = await tryGetSectionModulesCount({
			payload,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(initialCountResult.ok).toBe(true);
		if (initialCountResult.ok) {
			expect(initialCountResult.value).toBe(0);
		}

		// Add a module
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) return;

		// Should now have 1 module
		const finalCountResult = await tryGetSectionModulesCount({
			payload,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(finalCountResult.ok).toBe(true);
		if (finalCountResult.ok) {
			expect(finalCountResult.value).toBe(1);
		}
	});

	test("should validate no circular reference", async () => {
		// Create sections
		const rootResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Validation Root",
				description: "Root for validation",
			},
			overrideAccess: true,
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
		});

		expect(rootResult.ok).toBe(true);
		expect(childResult.ok).toBe(true);

		if (!rootResult.ok || !childResult.ok) return;

		// Valid parent change (no circular reference)
		const validResult = await tryValidateNoCircularReference({
			payload,
			sectionId: childResult.value.id,
			newParentSectionId: rootResult.value.id,
		});

		expect(validResult.ok).toBe(true);
		if (validResult.ok) {
			expect(validResult.value).toBe(true);
		}

		// Invalid parent change (would create circular reference)
		const invalidResult = await tryValidateNoCircularReference({
			payload,
			sectionId: rootResult.value.id,
			newParentSectionId: childResult.value.id,
		});

		expect(invalidResult.ok).toBe(true);
		if (invalidResult.ok) {
			expect(invalidResult.value).toBe(false);
		}
	});

	test("should get course structure with nested sections and activity modules", async () => {
		// Create a separate course for this test to avoid interference from other tests
		const structureTestCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Structure Test Course",
				description: "A course for testing structure representation",
				slug: "structure-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(structureTestCourseResult.ok).toBe(true);
		if (!structureTestCourseResult.ok) return;

		const structureTestCourse = structureTestCourseResult.value;

		// Create a complex course structure
		// Root Section 1: Introduction
		const introResult = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Introduction",
				description: "Course introduction",
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(introResult.ok).toBe(true);
		if (!introResult.ok) return;

		// Root Section 2: Main Content
		const mainResult = await tryCreateSection({
			payload,
			data: {
				course: structureTestCourse.id,
				title: "Main Content",
				description: "Main course content",
				contentOrder: 2,
			},
			overrideAccess: true,
		});

		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;

		// Subsection 2.1: Chapter 1
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
		});

		expect(chapter1Result.ok).toBe(true);
		if (!chapter1Result.ok) return;

		// Subsection 2.2: Chapter 2
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
		});

		expect(chapter2Result.ok).toBe(true);
		if (!chapter2Result.ok) return;

		// Sub-subsection 2.1.1: Section 1.1
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
		});

		expect(section11Result.ok).toBe(true);
		if (!section11Result.ok) return;

		// Create additional activity modules
		const activityModule2Result = await tryCreateQuizModule({
			payload,
			title: "Test Activity Module 2",
			description: "Second test activity module",
			userId: testUser.id,
			instructions: "Test quiz instructions",
			overrideAccess: true,
		} satisfies CreateQuizModuleArgs);

		const activityModule3Result = await tryCreateDiscussionModule({
			payload,
			title: "Test Activity Module 3",
			description: "Third test activity module",
			userId: testUser.id,
			instructions: "Test discussion instructions",
			overrideAccess: true,
		} satisfies CreateDiscussionModuleArgs);

		expect(activityModule2Result.ok).toBe(true);
		expect(activityModule3Result.ok).toBe(true);

		if (!activityModule2Result.ok || !activityModule3Result.ok) return;

		// Add activity modules to different sections
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: introResult.value.id,
			overrideAccess: true,
		});

		const link2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule2Result.value.id,
			sectionId: chapter1Result.value.id,
			overrideAccess: true,
		});

		const link3Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule3Result.value.id,
			sectionId: section11Result.value.id,
			overrideAccess: true,
		});

		expect(link1Result.ok).toBe(true);
		expect(link2Result.ok).toBe(true);
		expect(link3Result.ok).toBe(true);

		if (!link1Result.ok || !link2Result.ok || !link3Result.ok) return;

		// Get the course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: structureTestCourse.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const structure = structureResult.value;

		// Verify structure properties
		expect(structure.courseId).toBe(structureTestCourse.id);
		expect(Array.isArray(structure.sections)).toBe(true);
		expect(structure.sections.length).toBe(3); // Default section, Introduction and Main Content

		// Verify root sections are ordered correctly
		// Find our test sections (skip the default section)
		const introSection = structure.sections.find(
			(s) => s.title === "Introduction",
		);
		const mainContentSection = structure.sections.find(
			(s) => s.title === "Main Content",
		);

		expect(introSection).toBeDefined();
		expect(mainContentSection).toBeDefined();

		if (introSection && mainContentSection) {
			// Verify sections are in correct relative order (Introduction before Main Content)
			expect(introSection.contentOrder).toBeLessThan(
				mainContentSection.contentOrder,
			);

			// Verify Introduction section has one activity module
			expect(introSection.content.length).toBe(1);
			expect(introSection.content[0]!.type).toBe("activity-module");
			expect(introSection.content[0]!.id).toBe(link1Result.value.id);

			// Verify Main Content section structure
			expect(mainContentSection.content.length).toBe(2); // Chapter 1 and Chapter 2

			// Verify Chapter 1
			const chapter1 = mainContentSection.content[0]!;
			expect(chapter1.type).toBe("section");
			if (chapter1.type === "section") {
				expect(chapter1.title).toBe("Chapter 1");
				expect(chapter1.contentOrder).toBe(0);
				expect(chapter1.content.length).toBe(2); // Activity module and Section 1.1

				// Find the activity module in Chapter 1
				const chapter1ActivityModule = chapter1.content.find(
					(item) => item.type === "activity-module",
				);
				expect(chapter1ActivityModule).toBeDefined();
				if (
					chapter1ActivityModule &&
					chapter1ActivityModule.type === "activity-module"
				) {
					expect(chapter1ActivityModule.id).toBe(link2Result.value.id);
				}

				// Find Section 1.1 in Chapter 1
				const section11 = chapter1.content.find(
					(item) => item.type === "section",
				);
				expect(section11).toBeDefined();
				if (section11 && section11.type === "section") {
					expect(section11.title).toBe("Section 1.1");
					expect(section11.contentOrder).toBe(0);
					expect(section11.content.length).toBe(1);
					expect(section11.content[0]!.type).toBe("activity-module");
					if (section11.content[0]!.type === "activity-module") {
						expect(section11.content[0]!.id).toBe(link3Result.value.id);
					}
				}
			}

			// Verify Chapter 2
			const chapter2 = mainContentSection.content[1]!;
			expect(chapter2.type).toBe("section");
			if (chapter2.type === "section") {
				expect(chapter2.title).toBe("Chapter 2");
				expect(chapter2.contentOrder).toBe(1);
				expect(chapter2.content.length).toBe(0);
			}
		}
	});

	test("should get course structure with empty course", async () => {
		// Create a new course without any sections
		const emptyCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Empty Course",
				description: "A course with no sections",
				slug: "empty-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(emptyCourseResult.ok).toBe(true);
		if (!emptyCourseResult.ok) return;

		// Get the course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: emptyCourseResult.value.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const structure = structureResult.value;

		// Verify empty structure
		expect(structure.courseId).toBe(emptyCourseResult.value.id);
		expect(structure.sections.length).toBe(1); // Default section is automatically created
	});

	test("should get course structure with sections but no activity modules", async () => {
		// Create sections without activity modules
		const section1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Empty Section 1",
				description: "Section with no modules",
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		const section2Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Empty Section 2",
				description: "Another section with no modules",
				contentOrder: 2,
			},
			overrideAccess: true,
		});

		expect(section1Result.ok).toBe(true);
		expect(section2Result.ok).toBe(true);

		if (!section1Result.ok || !section2Result.ok) return;

		// Get the course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const structure = structureResult.value;

		// Verify structure has sections but no items
		expect(structure.sections.length).toBeGreaterThan(0);

		// Find our test sections
		const emptySection1 = structure.sections.find(
			(s) => s.title === "Empty Section 1",
		);
		const emptySection2 = structure.sections.find(
			(s) => s.title === "Empty Section 2",
		);

		expect(emptySection1).toBeDefined();
		expect(emptySection2).toBeDefined();

		if (emptySection1 && emptySection2) {
			expect(emptySection1.content.length).toBe(0);
			expect(emptySection2.content.length).toBe(0);
		}
	});

	test("should handle course structure with deeply nested sections", async () => {
		// Create a deeply nested structure (4 levels)
		const level1Result = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Level 1",
				description: "First level",
				contentOrder: 1,
			},
			overrideAccess: true,
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
		});

		expect(level4Result.ok).toBe(true);
		if (!level4Result.ok) return;

		// Add activity module to the deepest level
		const linkResult = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: level4Result.value.id,
			overrideAccess: true,
		});

		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) return;

		// Get the course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: testCourse.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		const structure = structureResult.value;

		console.log(JSON.stringify(structure, null, 2));

		// Verify deep nesting
		const level1 = structure.sections.find((s) => s.title === "Level 1");
		expect(level1).toBeDefined();

		if (level1) {
			expect(level1.content.length).toBe(1);

			const level2 = level1.content[0]!;
			expect(level2.type).toBe("section");
			if (level2.type === "section") {
				expect(level2.title).toBe("Level 2");
				expect(level2.content.length).toBe(1);

				const level3 = level2.content[0]!;
				expect(level3.type).toBe("section");
				if (level3.type === "section") {
					expect(level3.title).toBe("Level 3");
					expect(level3.content.length).toBe(1);

					const level4 = level3.content[0]!;
					expect(level4.type).toBe("section");
					if (level4.type === "section") {
						expect(level4.title).toBe("Level 4");
						expect(level4.content.length).toBe(1);
						expect(level4.content[0]!.type).toBe("activity-module");
						if (level4.content[0]!.type === "activity-module") {
							expect(level4.content[0]!.id).toBe(linkResult.value.id);
						}
					}
				}
			}
		}
	});

	test("should prevent delete last section in course", async () => {
		// Create a new course (which will have a default section)
		const newCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Single Section Course",
				description: "A course with only one section",
				slug: "single-section-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(newCourseResult.ok).toBe(true);
		if (!newCourseResult.ok) return;

		const newCourse = newCourseResult.value;

		// Find the default section
		const sectionsResult = await tryFindSectionsByCourse({
			payload,
			courseId: newCourse.id,
			overrideAccess: true,
		});

		expect(sectionsResult.ok).toBe(true);
		if (!sectionsResult.ok) return;

		expect(sectionsResult.value.length).toBe(1);
		const defaultSection = sectionsResult.value[0]!;

		// Try to delete the only section
		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: defaultSection.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/Cannot delete the last section in a course/,
			);
		}
	});

	test("should allow delete section when course has multiple sections", async () => {
		// Create a new course (which will have a default section)
		const newCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Multi Section Course",
				description: "A course with multiple sections",
				slug: "multi-section-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(newCourseResult.ok).toBe(true);
		if (!newCourseResult.ok) return;

		const newCourse = newCourseResult.value;

		// Create a second section
		const secondSectionResult = await tryCreateSection({
			payload,
			data: {
				course: newCourse.id,
				title: "Second Section",
				description: "Another section in the course",
				contentOrder: 2,
			},
			overrideAccess: true,
		});

		expect(secondSectionResult.ok).toBe(true);
		if (!secondSectionResult.ok) return;

		// Find the default section
		const sectionsResult = await tryFindSectionsByCourse({
			payload,
			courseId: newCourse.id,
			overrideAccess: true,
		});

		expect(sectionsResult.ok).toBe(true);
		if (!sectionsResult.ok) return;

		expect(sectionsResult.value.length).toBe(2);
		const defaultSection = sectionsResult.value[0]!;

		// Now we should be able to delete the default section
		const deleteResult = await tryDeleteSection({
			payload,
			sectionId: defaultSection.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(true);
	});

	test("should generate tree representation from course structure", async () => {
		// Create a new course for tree generation test
		const treeTestCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Tree Test Course",
				description: "A course for testing tree generation",
				slug: "tree-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(treeTestCourseResult.ok).toBe(true);
		if (!treeTestCourseResult.ok) return;

		const treeTestCourse = treeTestCourseResult.value;

		// Create a complex structure for tree generation
		const introResult = await tryCreateSection({
			payload,
			data: {
				course: treeTestCourse.id,
				title: "Introduction",
				description: "Course introduction",
				contentOrder: 1,
			},
			overrideAccess: true,
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
		});

		expect(introResult.ok).toBe(true);
		expect(mainResult.ok).toBe(true);
		if (!introResult.ok || !mainResult.ok) return;

		// Create nested sections
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
		});

		expect(chapter1Result.ok).toBe(true);
		if (!chapter1Result.ok) return;

		// Add activity modules
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: introResult.value.id,
			overrideAccess: true,
		});

		expect(link1Result.ok).toBe(true);
		if (!link1Result.ok) return;

		// Get course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: treeTestCourse.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		// Generate tree representation
		const tree = generateCourseStructureTree(
			structureResult.value,
			treeTestCourse.title,
		);

		// Verify tree contains expected elements
		expect(tree).toContain(treeTestCourse.title);
		expect(tree).toContain("Introduction");
		expect(tree).toContain("Main Content");
		expect(tree).toContain("Chapter 1");
		expect(tree).toContain(`Activity Module ${link1Result.value.id}`);

		// Verify tree structure characters
		expect(tree).toContain("├──");
		expect(tree).toContain("└──");
		expect(tree).toContain("│   ");

		// Log the generated tree for visual verification
		console.log("\nGenerated Course Structure Tree:");
		console.log(tree);
	});

	test("should create complex course structure with exact tree specification", async () => {
		// Create a new course for the complex structure test
		const complexCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Complex Structure Course",
				description: "A course with complex nested structure",
				slug: "complex-structure-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(complexCourseResult.ok).toBe(true);
		if (!complexCourseResult.ok) return;

		const complexCourse = complexCourseResult.value;

		// Create additional activity modules for this complex structure
		const activityModules = [];
		for (let i = 1; i <= 12; i++) {
			const moduleResult = await tryCreateAssignmentModule({
				payload,
				title: `Activity Module ${i}`,
				description: `Test activity module ${i}`,
				userId: testUser.id,
				instructions: `Instructions for activity module ${i}`,
				overrideAccess: true,
			});

			expect(moduleResult.ok).toBe(true);
			if (moduleResult.ok) {
				activityModules.push(moduleResult.value);
			}
		}

		// Create Section A (order: 1, contentOrder: 0)
		const sectionAResult = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section A",
				description: "First main section",
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionAResult.ok).toBe(true);
		if (!sectionAResult.ok) return;

		// Add Activity Module A1 (contentOrder: 1)
		const linkA1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[0]!.id,
			sectionId: sectionAResult.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkA1Result.ok).toBe(true);
		if (!linkA1Result.ok) return;

		// Create Section A.1 (order: 1, contentOrder: 2)
		const sectionA1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section A.1",
				description: "Subsection A.1",
				parentSection: sectionAResult.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionA1Result.ok).toBe(true);
		if (!sectionA1Result.ok) return;

		// Add Activity Module A1.1 (contentOrder: 1)
		const linkA11Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[1]!.id,
			sectionId: sectionA1Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkA11Result.ok).toBe(true);
		if (!linkA11Result.ok) return;

		// Create Section A.1.1 (order: 1, contentOrder: 2)
		const sectionA11Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section A.1.1",
				description: "Sub-subsection A.1.1",
				parentSection: sectionA1Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionA11Result.ok).toBe(true);
		if (!sectionA11Result.ok) return;

		// Add Activity Module A1.1.1 (contentOrder: 1)
		const linkA111Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[2]!.id,
			sectionId: sectionA11Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		// Add Activity Module A1.1.2 (contentOrder: 2)
		const linkA112Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[3]!.id,
			sectionId: sectionA11Result.value.id,
			order: 2,
			overrideAccess: true,
		});

		expect(linkA111Result.ok).toBe(true);
		expect(linkA112Result.ok).toBe(true);
		if (!linkA111Result.ok || !linkA112Result.ok) return;

		// Add Activity Module A1.2 (contentOrder: 3)
		const linkA12Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[4]!.id,
			sectionId: sectionA1Result.value.id,
			order: 3,
			overrideAccess: true,
		});

		expect(linkA12Result.ok).toBe(true);
		if (!linkA12Result.ok) return;

		// Add Activity Module A2 (contentOrder: 3)
		const linkA2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[5]!.id,
			sectionId: sectionAResult.value.id,
			order: 3,
			overrideAccess: true,
		});

		expect(linkA2Result.ok).toBe(true);
		if (!linkA2Result.ok) return;

		// Create Section A.2 (order: 2, contentOrder: 4)
		const sectionA2Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section A.2",
				description: "Subsection A.2",
				parentSection: sectionAResult.value.id,
				contentOrder: 2,
			},
			overrideAccess: true,
		});

		expect(sectionA2Result.ok).toBe(true);
		if (!sectionA2Result.ok) return;

		// Add Activity Module A2.1 (contentOrder: 1)
		const linkA21Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[6]!.id,
			sectionId: sectionA2Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkA21Result.ok).toBe(true);
		if (!linkA21Result.ok) return;

		// Create Section A.2.1 (order: 1, contentOrder: 2)
		const sectionA21Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section A.2.1",
				description: "Sub-subsection A.2.1",
				parentSection: sectionA2Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionA21Result.ok).toBe(true);
		if (!sectionA21Result.ok) return;

		// Add Activity Module A2.1.1 (contentOrder: 1)
		const linkA211Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[7]!.id,
			sectionId: sectionA21Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		// Add Activity Module A2.1.2 (contentOrder: 2)
		const linkA212Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[8]!.id,
			sectionId: sectionA21Result.value.id,
			order: 2,
			overrideAccess: true,
		});

		expect(linkA211Result.ok).toBe(true);
		expect(linkA212Result.ok).toBe(true);
		if (!linkA211Result.ok || !linkA212Result.ok) return;

		// Create Section B (order: 2, contentOrder: 0)
		const sectionBResult = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section B",
				description: "Second main section",
				contentOrder: 2,
			},
			overrideAccess: true,
		});

		expect(sectionBResult.ok).toBe(true);
		if (!sectionBResult.ok) return;

		// Create Section B.1 (order: 1, contentOrder: 1)
		const sectionB1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section B.1",
				description: "Subsection B.1",
				parentSection: sectionBResult.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionB1Result.ok).toBe(true);
		if (!sectionB1Result.ok) return;

		// Add Activity Module B1.1 (contentOrder: 1)
		const linkB11Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[9]!.id,
			sectionId: sectionB1Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkB11Result.ok).toBe(true);
		if (!linkB11Result.ok) return;

		// Create Section B.1.1 (order: 1, contentOrder: 2)
		const sectionB11Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section B.1.1",
				description: "Sub-subsection B.1.1",
				parentSection: sectionB1Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionB11Result.ok).toBe(true);
		if (!sectionB11Result.ok) return;

		// Add Activity Module B1.1.1 (contentOrder: 1)
		const linkB111Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[10]!.id,
			sectionId: sectionB11Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		// Add Activity Module B1.1.2 (contentOrder: 2)
		const linkB112Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[11]!.id,
			sectionId: sectionB11Result.value.id,
			order: 2,
			overrideAccess: true,
		});

		expect(linkB111Result.ok).toBe(true);
		expect(linkB112Result.ok).toBe(true);
		if (!linkB111Result.ok || !linkB112Result.ok) return;

		// Add Activity Module B1 (contentOrder: 2)
		const linkB1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[12]?.id || testActivityModule.id, // Use existing module if we run out
			sectionId: sectionBResult.value.id,
			order: 2,
			overrideAccess: true,
		});

		expect(linkB1Result.ok).toBe(true);
		if (!linkB1Result.ok) return;

		// Create Section C (order: 3, contentOrder: 0)
		const sectionCResult = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section C",
				description: "Third main section",
				contentOrder: 0,
			},
			overrideAccess: true,
		});

		expect(sectionCResult.ok).toBe(true);
		if (!sectionCResult.ok) return;

		// Add Activity Module C1 (contentOrder: 1)
		const linkC1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: testActivityModule.id,
			sectionId: sectionCResult.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkC1Result.ok).toBe(true);
		if (!linkC1Result.ok) return;

		// Create Section C.1 (order: 1, contentOrder: 2)
		const sectionC1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section C.1",
				description: "Subsection C.1",
				parentSection: sectionCResult.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionC1Result.ok).toBe(true);
		if (!sectionC1Result.ok) return;

		// Add Activity Module C1.1 (contentOrder: 1)
		const linkC11Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[0]!.id, // Reuse existing module
			sectionId: sectionC1Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		expect(linkC11Result.ok).toBe(true);
		if (!linkC11Result.ok) return;

		// Create Section C.1.1 (order: 1, contentOrder: 2)
		const sectionC11Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Section C.1.1",
				description: "Sub-subsection C.1.1",
				parentSection: sectionC1Result.value.id,
				contentOrder: 1,
			},
			overrideAccess: true,
		});

		expect(sectionC11Result.ok).toBe(true);
		if (!sectionC11Result.ok) return;

		// Add Activity Module C1.1.1 (contentOrder: 1)
		const linkC111Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[1]!.id, // Reuse existing module
			sectionId: sectionC11Result.value.id,
			order: 1,
			overrideAccess: true,
		});

		// Add Activity Module C1.1.2 (contentOrder: 2)
		const linkC112Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[2]!.id, // Reuse existing module
			sectionId: sectionC11Result.value.id,
			order: 2,
			overrideAccess: true,
		});

		expect(linkC111Result.ok).toBe(true);
		expect(linkC112Result.ok).toBe(true);
		if (!linkC111Result.ok || !linkC112Result.ok) return;

		// Add Activity Module C2 (contentOrder: 3)
		const linkC2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModules[3]!.id, // Reuse existing module
			sectionId: sectionCResult.value.id,
			order: 3,
			overrideAccess: true,
		});

		expect(linkC2Result.ok).toBe(true);
		if (!linkC2Result.ok) return;

		// Get the course structure
		const structureResult = await tryGetCourseStructure({
			payload,
			courseId: complexCourse.id,
			overrideAccess: true,
		});

		expect(structureResult.ok).toBe(true);
		if (!structureResult.ok) return;

		// Generate tree representation
		const tree = generateCourseStructureTree(
			structureResult.value,
			complexCourse.title,
		);

		// Verify tree contains expected elements
		expect(tree).toContain(complexCourse.title);
		expect(tree).toContain("Section A");
		expect(tree).toContain("Section B");
		expect(tree).toContain("Section C");
		expect(tree).toContain("Section A.1");
		expect(tree).toContain("Section A.1.1");
		expect(tree).toContain("Section A.2");
		expect(tree).toContain("Section A.2.1");
		expect(tree).toContain("Section B.1");
		expect(tree).toContain("Section B.1.1");
		expect(tree).toContain("Section C.1");
		expect(tree).toContain("Section C.1.1");

		// Verify tree structure characters
		expect(tree).toContain("├──");
		expect(tree).toContain("└──");
		expect(tree).toContain("│   ");

		// Log the generated tree for visual verification
		console.log("\nComplex Course Structure Tree:");
		console.log(tree);

		// Verify the structure matches the expected pattern
		const lines = tree.split("\n");
		expect(lines.length).toBeGreaterThan(20); // Should have many lines due to deep nesting

		// console.log("Activity modules created:", activityModules.length);
		// console.log("Activity modules:", activityModules.map(m => ({ id: m.id, title: m.title })));

		// Find the link for Activity Module 17 (which should be the 5th activity module we created)
		// We need to find the link ID, not the activity module ID
		// Let's find the link that corresponds to Activity Module 5 (which is activityModules[4])
		const targetActivityModule = activityModules[4]!; // This is Activity Module 5
		// console.log("Target activity module:", targetActivityModule);

		// Find the link for this activity module in Section A.1
		const linksInSectionA1 = await payload.find({
			collection: "course-activity-module-links",
			where: {
				and: [
					{ section: { equals: sectionA1Result.value.id } },
					{ activityModule: { equals: targetActivityModule.id } },
				],
			},
			overrideAccess: true,
		});

		// console.log("Links in Section A.1:", linksInSectionA1.docs);

		if (linksInSectionA1.docs.length > 0) {
			const linkToMove = linksInSectionA1.docs[0];
			// console.log("Link to move:", linkToMove);

			// Move this link to be positioned between Activity Module 2 and Section A.1.1
			// We need to set contentOrder to 2 to place it before Section A.1.1 (which has contentOrder: 2)
			const moveResult = await tryMoveActivityModuleBetweenSections({
				payload,
				linkId: linkToMove.id,
				newSectionId: sectionA1Result.value.id, // Stay in the same section
				newOrder: 2, // This will place it at contentOrder 2, before Section A.1.1
				overrideAccess: true,
			});

			expect(moveResult.ok).toBe(true);
			if (!moveResult.ok) return;

			expect(linkToMove.activityModule).toBeObject();
			if (typeof linkToMove.activityModule !== "object")
				throw new Error("Test Error: Activity module is not an object");

			console.log(
				`Moving link ${linkToMove.activityModule?.title} to section ${sectionA1Result.value.title} at contentOrder 2`,
			);
			// console.log("Move result:", moveResult.value);

			// Get the course structure again
			const structureResult2 = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});

			expect(structureResult2.ok).toBe(true);
			if (!structureResult2.ok) return;

			const structure2 = structureResult2.value;

			// Generate tree representation
			const tree2 = generateCourseStructureTree(
				structure2,
				complexCourse.title,
			);
			console.log("\nUpdated Course Structure Tree:");
			console.log(tree2);
		}
	});

	test("tryGeneralMove - comprehensive move scenarios", async () => {
		// Create a complex course structure for testing
		const complexCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "General Move Test Course",
				description: "Course for testing general move functionality",
				slug: "general-move-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		if (!complexCourseResult.ok) {
			throw new Error("Failed to create complex test course");
		}

		const complexCourse = complexCourseResult.value;

		// Create root sections
		const rootSection1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Root Section 1",
				description: "First root section",
				contentOrder: 1,
			},
			user: testUser as any,
			overrideAccess: true,
		});

		const rootSection2Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Root Section 2",
				description: "Second root section",
				contentOrder: 2,
			},
			user: testUser as any,
			overrideAccess: true,
		});

		if (!rootSection1Result.ok || !rootSection2Result.ok) {
			throw new Error("Failed to create root sections");
		}

		const rootSection1 = rootSection1Result.value;
		const rootSection2 = rootSection2Result.value;

		// Create child sections
		const childSection1Result = await tryCreateSection({
			payload,
			data: {
				course: complexCourse.id,
				title: "Child Section 1",
				description: "First child section",
				parentSection: rootSection1.id,
				contentOrder: 1,
			},
			user: testUser as any,
			overrideAccess: true,
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
			user: testUser as any,
			overrideAccess: true,
		});

		if (!childSection1Result.ok || !childSection2Result.ok) {
			throw new Error("Failed to create child sections");
		}

		const childSection1 = childSection1Result.value;
		const childSection2 = childSection2Result.value;

		// Create activity modules
		const activityModule1Result = await tryCreateAssignmentModule({
			payload,
			title: "Activity Module 1",
			description: "First activity module",
			userId: testUser.id,
			instructions: "Test assignment 1",
			overrideAccess: true,
		});

		const activityModule2Result = await tryCreateQuizModule({
			payload,
			title: "Activity Module 2",
			description: "Second activity module",
			userId: testUser.id,
			instructions: "Test quiz 1",
			overrideAccess: true,
		});

		if (!activityModule1Result.ok || !activityModule2Result.ok) {
			throw new Error("Failed to create activity modules");
		}

		const activityModule1 = activityModule1Result.value;
		const activityModule2 = activityModule2Result.value;

		// Add activity modules to sections
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule1.id,
			sectionId: rootSection1.id,
			order: 0,
			user: testUser as any,
			overrideAccess: true,
		});

		const link2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule2.id,
			sectionId: childSection1.id,
			order: 0,
			user: testUser as any,
			overrideAccess: true,
		});

		if (!link1Result.ok || !link2Result.ok) {
			throw new Error("Failed to add activity modules to sections");
		}

		const link1 = link1Result.value;
		const link2 = link2Result.value;

		// move module 1 to above child section 1
		const moveModule1AboveResult = await tryGeneralMove({
			payload,
			source: { id: link1.id, type: "activity-module" },
			target: { id: childSection1.id, type: "section" },
			location: "above",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveModule1AboveResult.ok).toBe(true);

		// log the tree
		const structure = await tryGetCourseStructure({
			payload,
			courseId: complexCourse.id,
			overrideAccess: true,
		});
		if (structure.ok) {
			console.log(
				generateCourseStructureTree(structure.value, complexCourse.title),
			);
		}

		// Test 1: Move section above another section
		console.log("\n=== Test 1: Move section above another section ===");
		const moveAboveResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "above",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveAboveResult.ok).toBe(true);
		if (moveAboveResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}

			const updatedSection = moveAboveResult.value as CourseSection;
			expect(updatedSection.contentOrder).toBe(1);
			console.log(
				`✓ Moved childSection2 above childSection1, new contentOrder: ${updatedSection.contentOrder}`,
			);
		}

		// Test 2: Move section below another section
		console.log("\n=== Test 2: Move section below another section ===");
		const moveBelowResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "below",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveBelowResult.ok).toBe(true);
		if (moveBelowResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}
			const updatedSection = moveBelowResult.value as CourseSection;
			expect(updatedSection.contentOrder).toBe(2);
			console.log(
				`✓ Moved childSection2 below childSection1, new contentOrder: ${updatedSection.contentOrder}`,
			);
		}

		// Test 3: Move section inside another section
		console.log("\n=== Test 3: Move section inside another section ===");
		const moveInsideResult = await tryGeneralMove({
			payload,
			source: { id: childSection2.id, type: "section" },
			target: { id: rootSection2.id, type: "section" },
			location: "inside",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveInsideResult.ok).toBe(true);
		if (moveInsideResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}
			const updatedSection = moveInsideResult.value as CourseSection;
			const parentId =
				typeof updatedSection.parentSection === "number"
					? updatedSection.parentSection
					: updatedSection.parentSection?.id;
			expect(parentId).toBe(rootSection2.id);
			console.log(
				`✓ Moved childSection2 inside rootSection2, new parent: ${parentId}`,
			);
		}

		// Test 4: Move activity module above section
		console.log("\n=== Test 4: Move activity module above section ===");
		const moveModuleAboveResult = await tryGeneralMove({
			payload,
			source: { id: link1.id, type: "activity-module" },
			target: { id: childSection1.id, type: "section" },
			location: "above",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveModuleAboveResult.ok).toBe(true);
		if (moveModuleAboveResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}
			const updatedLink =
				moveModuleAboveResult.value as CourseActivityModuleLink;
			// With simplified approach, contentOrder gets recalculated starting from 0
			expect(updatedLink.contentOrder).toBe(0);
			console.log(
				`✓ Moved activity module above childSection1, new contentOrder: ${updatedLink.contentOrder}`,
			);
		}

		// Test 5: Move activity module below section
		console.log("\n=== Test 5: Move activity module below section ===");
		const moveModuleBelowResult = await tryGeneralMove({
			payload,
			source: { id: link1.id, type: "activity-module" },
			target: { id: childSection1.id, type: "section" },
			location: "below",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveModuleBelowResult.ok).toBe(true);
		if (moveModuleBelowResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}
			const updatedLink =
				moveModuleBelowResult.value as CourseActivityModuleLink;
			expect(updatedLink.contentOrder).toBe(1);
			console.log(
				`✓ Moved activity module below childSection1, new contentOrder: ${updatedLink.contentOrder}`,
			);
		}

		// Test 6: Move activity module above another activity module
		console.log(
			"\n=== Test 6: Move activity module above another activity module ===",
		);
		const moveModuleAboveModuleResult = await tryGeneralMove({
			payload,
			source: { id: link1.id, type: "activity-module" },
			target: { id: link2.id, type: "activity-module" },
			location: "above",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveModuleAboveModuleResult.ok).toBe(true);
		if (moveModuleAboveModuleResult.ok) {
			// log the tree
			const structure = await tryGetCourseStructure({
				payload,
				courseId: complexCourse.id,
				overrideAccess: true,
			});
			if (structure.ok) {
				console.log(
					generateCourseStructureTree(structure.value, complexCourse.title),
				);
			}
			const updatedLink =
				moveModuleAboveModuleResult.value as CourseActivityModuleLink;
			expect(updatedLink.contentOrder).toBe(0);
			console.log(
				`✓ Moved activity module above another activity module, new contentOrder: ${updatedLink.contentOrder}`,
			);
		}

		// Test 7: Error case - move inside activity module
		console.log("\n=== Test 7: Error case - move inside activity module ===");
		const moveInsideModuleResult = await tryGeneralMove({
			payload,
			source: { id: childSection1.id, type: "section" },
			target: { id: link1.id, type: "activity-module" },
			location: "inside",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(moveInsideModuleResult.ok).toBe(false);
		if (!moveInsideModuleResult.ok) {
			expect(moveInsideModuleResult.error.message).toContain(
				"Cannot move items inside an activity module",
			);
			console.log(
				`✓ Correctly rejected move inside activity module: ${moveInsideModuleResult.error.message}`,
			);
		}

		// Test 8: Error case - circular reference
		console.log("\n=== Test 8: Error case - circular reference ===");
		const circularRefResult = await tryGeneralMove({
			payload,
			source: { id: rootSection1.id, type: "section" },
			target: { id: childSection1.id, type: "section" },
			location: "inside",
			user: testUser as any,
			overrideAccess: true,
		});

		expect(circularRefResult.ok).toBe(false);
		if (!circularRefResult.ok) {
			expect(circularRefResult.error.message).toContain("circular reference");
			console.log(
				`✓ Correctly rejected circular reference: ${circularRefResult.error.message}`,
			);
		}

		// Test 9: Verify final structure
		console.log("\n=== Test 9: Verify final structure ===");
		const finalStructureResult = await tryGetCourseStructure({
			payload,
			courseId: complexCourse.id,
			user: testUser as any,
			overrideAccess: true,
		});

		expect(finalStructureResult.ok).toBe(true);
		if (finalStructureResult.ok) {
			const structure = finalStructureResult.value;
			const tree = generateCourseStructureTree(structure, complexCourse.title);
			console.log("\nFinal Course Structure Tree:");
			console.log(tree);
		}

		console.log("\n✅ All tryGeneralMove tests passed!");
	});

	test("should move activity module above another activity module", async () => {
		// Create a new course for this specific test
		const moveTestCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Move Test Course",
				description: "Course for testing activity module moves",
				slug: "move-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(moveTestCourseResult.ok).toBe(true);
		if (!moveTestCourseResult.ok) return;

		const moveTestCourse = moveTestCourseResult.value;

		// create a section
		const section1Result = await tryCreateSection({
			payload,
			data: {
				course: moveTestCourse.id,
				title: "Section 1",
				description: "First section",
			},
			overrideAccess: true,
		});

		// create a section 2
		const section2Result = await tryCreateSection({
			payload,
			data: {
				course: moveTestCourse.id,
				title: "Section 2",
				description: "Second section",
			},
			overrideAccess: true,
		});

		// crea
		const section3Result = await tryCreateSection({
			payload,
			data: {
				course: moveTestCourse.id,
				title: "Section 3",
				description: "Third section",
			},
			overrideAccess: true,
		});

		if (!section3Result.ok || !section1Result.ok || !section2Result.ok) return;

		// Create a section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: moveTestCourse.id,
				title: "Discussions",
				description: "Discussion section",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// create a module in section 1
		const module1Result = await tryCreateDiscussionModule({
			payload,
			title: "Module 1",
			description: "First module",
			userId: testUser.id,
			instructions: "Test discussion 1",
			overrideAccess: true,
		});

		expect(module1Result.ok).toBe(true);
		if (!module1Result.ok) return;

		// create a module in section 2
		const module2Result = await tryCreateDiscussionModule({
			payload,
			title: "Module 2",
			description: "Second module",
			userId: testUser.id,
			instructions: "Test discussion 2",
			overrideAccess: true,
		});

		expect(module2Result.ok).toBe(true);
		if (!module2Result.ok) return;

		// Create activity modules
		const activityModule3Result = await tryCreateDiscussionModule({
			payload,
			title: "Activity Module 3",
			description: "Third activity module",
			userId: testUser.id,
			instructions: "Test discussion 3",
			overrideAccess: true,
		});

		const activityModule4Result = await tryCreateDiscussionModule({
			payload,
			title: "Activity Module 4",
			description: "Fourth activity module",
			userId: testUser.id,
			instructions: "Test discussion 4",
			overrideAccess: true,
		});

		expect(activityModule3Result.ok).toBe(true);
		expect(activityModule4Result.ok).toBe(true);
		if (!activityModule3Result.ok || !activityModule4Result.ok) return;

		// add module 1 to section 1
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: module1Result.value.id,
			sectionId: section1Result.value.id,
			overrideAccess: true,
		});

		expect(link1Result.ok).toBe(true);
		if (!link1Result.ok) return;

		// add module 2 to section 2
		const link2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: module2Result.value.id,
			sectionId: section2Result.value.id,
			overrideAccess: true,
		});

		expect(link2Result.ok).toBe(true);
		if (!link2Result.ok) return;

		// Add modules to section (in order: 4 first, then 3)
		const link4Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule4Result.value.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		const link3Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: activityModule3Result.value.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(link4Result.ok).toBe(true);
		expect(link3Result.ok).toBe(true);
		if (!link4Result.ok || !link3Result.ok) return;

		// Log initial structure
		const initialStructureResult = await tryGetCourseStructure({
			payload,
			courseId: moveTestCourse.id,
			overrideAccess: true,
		});

		expect(initialStructureResult.ok).toBe(true);
		if (initialStructureResult.ok) {
			console.log("courseStructureTree incubate leading-edge technologies");
			console.log(
				generateCourseStructureTree(
					initialStructureResult.value,
					moveTestCourse.title,
				),
			);
		}

		// Move activity-module 3 above activity-module 4
		console.log(
			`Moving ${link3Result.value.sectionTitle ?? link3Result.value.activityModuleName} to above ${link4Result.value.sectionTitle ?? link4Result.value.activityModuleName}`,
		);

		console.log(link3Result.value);
		console.log(link4Result.value);

		const moveResult = await tryGeneralMove({
			payload,
			source: { id: link3Result.value.id, type: "activity-module" },
			target: { id: link4Result.value.id, type: "activity-module" },
			location: "above",
			overrideAccess: true,
		});

		expect(moveResult.ok).toBe(true);
		if (!moveResult.ok) return;

		// Log final structure
		const finalStructureResult = await tryGetCourseStructure({
			payload,
			courseId: moveTestCourse.id,
			overrideAccess: true,
		});

		expect(finalStructureResult.ok).toBe(true);
		if (finalStructureResult.ok) {
			console.log("courseStructureTree incubate leading-edge technologies");
			console.log(
				generateCourseStructureTree(
					finalStructureResult.value,
					moveTestCourse.title,
				),
			);

			// Verify the move worked - Activity Module 3 should now be above Activity Module 4
			const discussionsSection = finalStructureResult.value.sections.find(
				(s) => s.title === "Discussions",
			);
			expect(discussionsSection).toBeDefined();
			if (discussionsSection) {
				expect(discussionsSection.content.length).toBe(2);
				console.log(discussionsSection.content);

				// Find the modules in the section
				const module3 = discussionsSection.content.find(
					(item) =>
						item.type === "activity-module" &&
						"module" in item &&
						item.module.title === "Activity Module 3",
				);
				const module4 = discussionsSection.content.find(
					(item) =>
						item.type === "activity-module" &&
						"module" in item &&
						item.module.title === "Activity Module 4",
				);

				expect(module3).toBeDefined();
				expect(module4).toBeDefined();

				if (module3 && module4) {
					// Activity Module 3 should now have contentOrder 0, Activity Module 4 should have contentOrder 1
					expect(module3.contentOrder).toBe(0);
					expect(module4.contentOrder).toBe(1);
				}
			}
		}
	});

	test("should respect custom module names from course module settings", async () => {
		// Create a new course for this test
		const customNameCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Custom Name Test Course",
				description: "Course for testing custom module names",
				slug: "custom-name-test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		});

		expect(customNameCourseResult.ok).toBe(true);
		if (!customNameCourseResult.ok) return;

		const customNameCourse = customNameCourseResult.value;

		// Create a section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: customNameCourse.id,
				title: "Week 1",
				description: "First week content",
			},
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) return;

		// Create activity modules
		const assignmentResult = await tryCreateAssignmentModule({
			payload,
			title: "Generic Assignment Title",
			description: "A reusable assignment",
			userId: testUser.id,
			instructions: "Complete the assignment",
			overrideAccess: true,
		});

		const quizResult = await tryCreateQuizModule({
			payload,
			title: "Generic Quiz Title",
			description: "A reusable quiz",
			userId: testUser.id,
			instructions: "Complete the quiz",
			overrideAccess: true,
		});

		expect(assignmentResult.ok).toBe(true);
		expect(quizResult.ok).toBe(true);
		if (!assignmentResult.ok || !quizResult.ok) return;

		// Add modules to section WITHOUT custom names first
		const link1Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: assignmentResult.value.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		const link2Result = await tryAddActivityModuleToSection({
			payload,
			activityModuleId: quizResult.value.id,
			sectionId: sectionResult.value.id,
			overrideAccess: true,
		});

		expect(link1Result.ok).toBe(true);
		expect(link2Result.ok).toBe(true);
		if (!link1Result.ok || !link2Result.ok) return;

		// Get initial structure (should show original titles)
		const initialStructureResult = await tryGetCourseStructure({
			payload,
			courseId: customNameCourse.id,
			overrideAccess: true,
		});

		expect(initialStructureResult.ok).toBe(true);
		if (!initialStructureResult.ok) return;

		console.log("\n=== Initial Structure (No Custom Names) ===");
		console.log(
			generateCourseStructureTree(
				initialStructureResult.value,
				customNameCourse.title,
			),
		);

		// Verify original titles are used
		const initialSection = initialStructureResult.value.sections.find(
			(s) => s.title === "Week 1",
		);
		expect(initialSection).toBeDefined();
		if (initialSection) {
			const module1 = initialSection.content.find(
				(item) =>
					item.type === "activity-module" && item.id === link1Result.value.id,
			);
			const module2 = initialSection.content.find(
				(item) =>
					item.type === "activity-module" && item.id === link2Result.value.id,
			);

			expect(module1).toBeDefined();
			expect(module2).toBeDefined();
			if (module1 && module1.type === "activity-module") {
				expect(module1.module.title).toBe("Generic Assignment Title");
			}
			if (module2 && module2.type === "activity-module") {
				expect(module2.module.title).toBe("Generic Quiz Title");
			}
		}

		// Now update the links with custom names
		await payload.update({
			collection: "course-activity-module-links",
			id: link1Result.value.id,
			data: {
				settings: {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Week 1 Reflection Assignment",
					},
				},
			},
			overrideAccess: true,
		});

		await payload.update({
			collection: "course-activity-module-links",
			id: link2Result.value.id,
			data: {
				settings: {
					version: "v1",
					settings: {
						type: "quiz",
						name: "Week 1 Comprehension Quiz",
					},
				},
			},
			overrideAccess: true,
		});

		// Get updated structure (should show custom names)
		const updatedStructureResult = await tryGetCourseStructure({
			payload,
			courseId: customNameCourse.id,
			overrideAccess: true,
		});

		expect(updatedStructureResult.ok).toBe(true);
		if (!updatedStructureResult.ok) return;

		console.log("\n=== Updated Structure (With Custom Names) ===");
		console.log(
			generateCourseStructureTree(
				updatedStructureResult.value,
				customNameCourse.title,
			),
		);

		// Verify custom names are used
		const updatedSection = updatedStructureResult.value.sections.find(
			(s) => s.title === "Week 1",
		);
		expect(updatedSection).toBeDefined();
		if (updatedSection) {
			const customModule1 = updatedSection.content.find(
				(item) =>
					item.type === "activity-module" && item.id === link1Result.value.id,
			);
			const customModule2 = updatedSection.content.find(
				(item) =>
					item.type === "activity-module" && item.id === link2Result.value.id,
			);

			expect(customModule1).toBeDefined();
			expect(customModule2).toBeDefined();
			if (customModule1 && customModule1.type === "activity-module") {
				expect(customModule1.module.title).toBe("Week 1 Reflection Assignment");
			}
			if (customModule2 && customModule2.type === "activity-module") {
				expect(customModule2.module.title).toBe("Week 1 Comprehension Quiz");
			}
		}

		console.log("\n✅ Custom module names test passed!");
	});
});
