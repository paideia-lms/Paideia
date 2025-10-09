import type { CollectionConfig, Payload } from "payload";
import type { CourseCategory } from "server/payload-types";

// Course Categories collection - hierarchical course organization
export const CourseCategories = {
	slug: "course-categories" as const,
	defaultSort: "name",
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			label: "Category Name",
		},
		{
			name: "parent",
			type: "relationship",
			relationTo: "course-categories",
			label: "Parent Category",
			admin: {
				description: "Optional parent category for nested organization",
			},
		},
		{
			name: "subcategories",
			type: "join",
			on: "parent",
			collection: "course-categories",
			label: "Subcategories",
		},
		{
			name: "courses",
			type: "join",
			on: "category",
			collection: "courses",
			label: "Courses",
		},
	],
	hooks: {
		beforeValidate: [
			async ({ data, req, operation, originalDoc }) => {
				// Only validate on create/update operations
				if (operation !== "create" && operation !== "update") {
					return data;
				}

				// Check for circular reference
				if (data?.parent) {
					const parentId =
						typeof data.parent === "number" ? data.parent : data.parent.id;
					const currentId = originalDoc?.id;

					if (parentId === currentId) {
						throw new Error("A category cannot be its own parent");
					}

					// Check if the new parent is a descendant of the current category
					if (currentId && req?.payload) {
						const isDescendant = await checkIsDescendant(
							req.payload,
							currentId,
							parentId,
						);
						if (isDescendant) {
							throw new Error(
								"Cannot set parent to a descendant category (circular reference)",
							);
						}
					}
				}

				// Check max depth from global config
				if (data?.parent && req?.payload) {
					const globalConfig = await req.payload.findGlobal({
						slug: "system-grade-table",
					});

					const maxDepth = globalConfig?.maxCategoryDepth;

					if (maxDepth != null && maxDepth > 0) {
						const parentId =
							typeof data.parent === "number" ? data.parent : data.parent.id;
						const parentDepth = await calculateDepth(req.payload, parentId);
						const newDepth = parentDepth + 1;

						if (newDepth >= maxDepth) {
							throw new Error(
								`Category depth limit exceeded. Maximum allowed depth is ${maxDepth}`,
							);
						}
					}
				}

				return data;
			},
		],
	},
} as const satisfies CollectionConfig;

/**
 * Check if a category is a descendant of another category
 */
async function checkIsDescendant(
	payload: Payload,
	ancestorId: number,
	candidateId: number,
): Promise<boolean> {
	let currentId: number | null = candidateId;

	while (currentId !== null) {
		if (currentId === ancestorId) {
			return true;
		}

		const category: CourseCategory = await payload.findByID({
			collection: "course-categories",
			id: currentId,
			depth: 0,
		});

		currentId =
			typeof category.parent === "number"
				? category.parent
				: (category.parent?.id ?? null);
	}

	return false;
}

/**
 * Calculate the depth of a category (0 for root, 1 for first level, etc.)
 */
async function calculateDepth(
	payload: Payload,
	categoryId: number,
): Promise<number> {
	let depth = 0;
	let currentId: number | null = categoryId;

	while (currentId !== null) {
		const category: CourseCategory = await payload.findByID({
			collection: "course-categories",
			id: currentId,
			depth: 0,
		});

		currentId =
			typeof category.parent === "number"
				? category.parent
				: (category.parent?.id ?? null);

		if (currentId !== null) {
			depth++;
		}
	}

	return depth;
}
