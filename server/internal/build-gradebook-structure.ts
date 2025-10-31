import type { GradebookSetupItem } from "./gradebook-management";

/**
 * Type for category data as returned from Payload queries
 */
export interface CategoryData {
    id: number;
    gradebook: number;
    parent: number | null;
    name: string;
    weight: number | null;
    subcategories: number[];
    items: number[];
}

/**
 * Type for item data as returned from Payload queries
 */
export interface ItemData {
    id: number;
    gradebook: number;
    category: number | null;
    name: string;
    activityModuleType: string | null;
    activityModuleName: string | null;
    weight: number;
    maxGrade: number;
}

/**
 * Recursively builds the category structure from categories and items
 * 
 * @param categoryId - The category ID to build structure for, or null for root categories
 * @param categories - Array of all categories
 * @param items - Array of all items
 * @returns Array of GradebookSetupItem representing the structure
 * 
 * @remarks
 * - When categoryId === null, only processes categories (not items) because root items are handled separately
 * - When categoryId is a number, processes both items and subcategories for that category
 */
export function buildCategoryStructure(
    categoryId: number | null,
    categories: CategoryData[],
    items: ItemData[],
): GradebookSetupItem[] {
    const result: GradebookSetupItem[] = [];

    // Get categories with this parent
    const childCategories = categories.filter(
        (cat) => cat.parent === categoryId,
    );

    // Only process items if we're not at the root level (categoryId !== null)
    // Root-level items are handled separately in tryGetGradebookJsonRepresentation
    if (categoryId !== null) {
        // Get items with this category
        const categoryItems = items.filter((item) => item.category === categoryId);

        // Process items first (before categories at the same level)
        for (const item of categoryItems) {
            result.push({
                id: item.id,
                type: (item.activityModuleType ?? "manual_item") as
                    | "manual_item"
                    | "category"
                    | "page"
                    | "whiteboard"
                    | "assignment"
                    | "quiz"
                    | "discussion",
                name: item.activityModuleName ?? item.name,
                weight: item.weight || null,
                max_grade: item.maxGrade || null,
            });
        }
    }

    // Process categories recursively
    for (const category of childCategories) {
        // Recursively get nested items
        const nestedStructure = buildCategoryStructure(
            category.id,
            categories,
            items,
        );

        result.push({
            id: category.id,
            type: "category",
            name: category.name,
            weight: category.weight || null,
            max_grade: null, // Categories don't have max_grade
            grade_items: nestedStructure.length > 0 ? nestedStructure : undefined,
        });
    }

    return result;
}
