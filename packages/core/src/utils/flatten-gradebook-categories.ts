/**
 * Flattened category with hierarchy information
 */
export interface FlattenedCategory {
	id: number;
	name: string;
	parentId: number | null;
	depth: number;
	path: string; // Full path like "Parent > Child > Grandchild"
}

/**
 * Minimal item shape needed for flattening (category with optional nested items)
 */
interface GradebookCategoryItem {
	type: string;
	id: number;
	name: string;
	grade_items?: GradebookCategoryItem[];
}

/**
 * Flattens the gradebook category structure recursively to get all categories
 * including nested ones, with their hierarchy information
 */
export function flattenGradebookCategories(
	items: GradebookCategoryItem[],
	parentId: number | null = null,
	depth = 0,
	parentPath = "",
): FlattenedCategory[] {
	const result: FlattenedCategory[] = [];

	for (const item of items) {
		if (item.type === "category") {
			const currentPath = parentPath
				? `${parentPath} > ${item.name}`
				: item.name;

			result.push({
				id: item.id,
				name: item.name,
				parentId,
				depth,
				path: currentPath,
			});

			if (item.grade_items) {
				const nestedCategories = flattenGradebookCategories(
					item.grade_items,
					item.id,
					depth + 1,
					currentPath,
				);
				result.push(...nestedCategories);
			}
		}
	}

	return result;
}
