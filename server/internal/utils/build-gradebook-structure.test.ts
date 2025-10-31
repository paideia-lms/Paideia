import { describe, expect, it } from "bun:test";
import { buildCategoryStructure } from "./build-gradebook-structure";

describe("Build Gradebook Structure", () => {
    it("should not duplicate root-level items when processing root categories", () => {
        // Setup: Create categories and items data similar to what comes from Payload
        const categories = [
            {
                id: 1,
                gradebook: 2,
                parent: null,
                name: "Category 1",
                weight: 50,
                subcategories: [2],
                items: [],
            },
            {
                id: 2,
                gradebook: 2,
                parent: 1,
                name: "Subcategory 1",
                weight: 30,
                subcategories: [],
                items: [3],
            },
        ];

        const items = [
            {
                id: 6,
                gradebook: 2,
                category: null,
                name: "Root Item 1",
                activityModuleType: null,
                activityModuleName: null,
                weight: 0,
                maxGrade: 100,
            },
            {
                id: 7,
                gradebook: 2,
                category: null,
                name: "Root Item 2",
                activityModuleType: null,
                activityModuleName: null,
                weight: 0,
                maxGrade: 100,
            },
            {
                id: 3,
                gradebook: 2,
                category: 2, // Item in subcategory
                name: "Item in Subcategory",
                activityModuleType: null,
                activityModuleName: null,
                weight: 10,
                maxGrade: 100,
            },
        ];

        // When processing root categories (categoryId = null)
        // It should NOT include root-level items (items with category === null)
        // because those are processed separately
        const result = buildCategoryStructure(null, categories, items);

        // Count how many times root items appear in the result
        const rootItemIds = new Set([6, 7]);
        const foundRootItems = result.filter(
            (item) => rootItemIds.has(item.id),
        );

        // Root items should NOT appear in the result when processing root categories
        // because they are handled separately
        expect(foundRootItems.length).toBe(0);

        // Should only have root categories (Category 1 with its subcategory)
        expect(result.length).toBe(1);
        expect(result[0].type).toBe("category");
        expect(result[0].id).toBe(1);
    });

    it("should include items when processing a specific category", () => {
        const categories = [
            {
                id: 1,
                gradebook: 2,
                parent: null,
                name: "Category 1",
                weight: 40,
                subcategories: [],
                items: [3, 4],
            },
        ];

        const items = [
            {
                id: 3,
                gradebook: 2,
                category: 1, // Item in category
                name: "Item 1",
                activityModuleType: null,
                activityModuleName: null,
                weight: 10,
                maxGrade: 100,
            },
            {
                id: 4,
                gradebook: 2,
                category: 1, // Item in category
                name: "Item 2",
                activityModuleType: null,
                activityModuleName: null,
                weight: 20,
                maxGrade: 100,
            },
        ];

        // When processing a specific category (categoryId = 1)
        // It SHOULD include items with category === 1
        // Note: buildCategoryStructure returns items/subcategories UNDER the given category,
        // not the category itself
        const result = buildCategoryStructure(1, categories, items);

        // Should have only the items (no subcategories, and not the category itself)
        expect(result.length).toBe(2);
        expect(result[0].id).toBe(3);
        expect(result[0].type).toBe("manual_item");
        expect(result[1].id).toBe(4);
        expect(result[1].type).toBe("manual_item");
    });

    it("should handle nested categories correctly", () => {
        const categories = [
            {
                id: 1,
                gradebook: 2,
                parent: null,
                name: "Root Category",
                weight: 60,
                subcategories: [2],
                items: [],
            },
            {
                id: 2,
                gradebook: 2,
                parent: 1,
                name: "Nested Category",
                weight: 40,
                subcategories: [],
                items: [3],
            },
        ];

        const items = [
            {
                id: 3,
                gradebook: 2,
                category: 2, // Item in nested category
                name: "Nested Item",
                activityModuleType: null,
                activityModuleName: null,
                weight: 15,
                maxGrade: 100,
            },
        ];

        const result = buildCategoryStructure(null, categories, items);

        // Should have root category with nested category inside
        expect(result.length).toBe(1);
        expect(result[0].type).toBe("category");
        expect(result[0].id).toBe(1);
        expect(result[0].grade_items).toBeDefined();
        if (result[0].grade_items) {
            expect(result[0].grade_items.length).toBe(1);
            expect(result[0].grade_items[0].type).toBe("category");
            expect(result[0].grade_items[0].id).toBe(2);
            if (result[0].grade_items[0].grade_items) {
                expect(result[0].grade_items[0].grade_items.length).toBe(1);
                expect(result[0].grade_items[0].grade_items[0].id).toBe(3);
            }
        }
    });

    it("should include extra_credit field when building structure", () => {
        const categories: Array<{
            id: number;
            gradebook: number;
            parent: number | null;
            name: string;
            weight: number | null;
            subcategories: number[];
            items: number[];
        }> = [];

        const items = [
            {
                id: 1,
                gradebook: 2,
                category: null,
                name: "Regular Item",
                activityModuleType: null,
                activityModuleName: null,
                weight: 50,
                maxGrade: 100,
                extraCredit: false,
            },
            {
                id: 2,
                gradebook: 2,
                category: null,
                name: "Extra Credit Item",
                activityModuleType: null,
                activityModuleName: null,
                weight: 5,
                maxGrade: 100,
                extraCredit: true,
            },
        ];

        // Build structure for root categories (null)
        const categoryResult = buildCategoryStructure(null, categories, items);

        // Should have no categories
        expect(categoryResult.length).toBe(0);

        // Build structure for a category that contains items
        const categoryWithItems = [
            {
                id: 1,
                gradebook: 2,
                parent: null,
                name: "Category 1",
                weight: 50,
                subcategories: [],
                items: [3, 4],
            },
        ];

        const itemsInCategory = [
            {
                id: 3,
                gradebook: 2,
                category: 1,
                name: "Regular Item in Category",
                activityModuleType: null,
                activityModuleName: null,
                weight: 50,
                maxGrade: 100,
                extraCredit: false,
            },
            {
                id: 4,
                gradebook: 2,
                category: 1,
                name: "Extra Credit in Category",
                activityModuleType: null,
                activityModuleName: null,
                weight: 10,
                maxGrade: 100,
                extraCredit: true,
            },
        ];

        const result = buildCategoryStructure(1, categoryWithItems, itemsInCategory);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe(3);
        expect(result[0].extra_credit).toBe(false);
        expect(result[1].id).toBe(4);
        expect(result[1].extra_credit).toBe(true);
    });
});
