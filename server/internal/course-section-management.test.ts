import { beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
    tryAddActivityModuleToSection,
    tryCreateSection,
    tryDeleteSection,
    tryFindChildSections,
    tryFindRootSections,
    tryFindSectionById,
    tryFindSectionsByCourse,
    tryGetSectionAncestors,
    tryGetSectionDepth,
    tryGetSectionModulesCount,
    tryGetSectionTree,
    tryMoveActivityModuleBetweenSections,
    tryMoveSection,
    tryNestSection,
    tryReorderActivityModulesInSection,
    tryReorderSection,
    tryReorderSections,
    tryRemoveActivityModuleFromSection,
    tryUnnestSection,
    tryUpdateSection,
    tryValidateNoCircularReference,
} from "./course-section-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateActivityModule } from "./activity-module-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Section Management Functions", () => {
    let payload: Awaited<ReturnType<typeof getPayload>>;
    let mockRequest: Request;
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

        mockRequest = new Request("http://localhost:3000/test");

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
        const activityModuleResult = await tryCreateActivityModule(payload, {
            title: "Test Activity Module",
            description: "A test activity module",
            type: "assignment",
            userId: testUser.id,
            assignmentData: {
                instructions: "Test assignment instructions",
            },
        });

        if (!activityModuleResult.ok) {
            throw new Error("Failed to create test activity module");
        }

        testActivityModule = activityModuleResult.value;
    });

    test("should create a root section", async () => {
        const result = await tryCreateSection({
            payload,
            data: {
                course: testCourse.id,
                title: "Introduction",
                description: "Introduction to the course",
            },
            overrideAccess: true,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.title).toBe("Introduction");
            expect(result.value.description).toBe("Introduction to the course");
            expect(result.value.parentSection).toBeNull();
            expect(result.value.order).toBe(1);
        }
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
                order: 5,
            },
            overrideAccess: true,
        });

        expect(updateResult.ok).toBe(true);
        if (updateResult.ok) {
            expect(updateResult.value.title).toBe("Updated Title");
            expect(updateResult.value.description).toBe("Updated description");
            expect(updateResult.value.order).toBe(5);
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
            expect(result.value[0].title).toBe("Root Ancestor");
            expect(result.value[1].title).toBe("Child Ancestor");
            expect(result.value[2].title).toBe("Grandchild");
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
                order: 1,
            },
            overrideAccess: true,
        });

        const section2Result = await tryCreateSection({
            payload,
            data: {
                course: testCourse.id,
                title: "Section 2",
                description: "Second section",
                order: 2,
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
            newOrder: 2,
            overrideAccess: true,
        });

        expect(reorderResult.ok).toBe(true);
        if (reorderResult.ok) {
            expect(reorderResult.value.order).toBe(2);
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
                    order: i,
                },
                overrideAccess: true,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                sections.push(result.value);
            }
        }

        // Reorder sections (reverse order)
        const sectionIds = sections.map(s => s.id).reverse();
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
            expect(moveResult.value.order).toBe(1);
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
        const activityModule2Result = await tryCreateActivityModule(payload, {
            title: "Test Activity Module 2",
            description: "Second test activity module",
            type: "quiz",
            userId: testUser.id,
            quizData: {
                instructions: "Test quiz instructions",
            },
        });

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
});
