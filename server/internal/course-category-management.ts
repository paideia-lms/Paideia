import type { Payload } from "payload";
import { CourseCategories, Courses } from "server/payload.config";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { CourseCategory } from "../payload-types";

export interface CreateCategoryArgs {
	name: string;
	parent?: number;
}

export interface UpdateCategoryArgs {
	name?: string;
	parent?: number;
}

export interface CategoryTreeNode {
	id: number;
	name: string;
	parent: number | null;
	directCoursesCount: number;
	directSubcategoriesCount: number;
	totalNestedCoursesCount: number;
	subcategories: CategoryTreeNode[];
}

/**
 * Creates a new course category
 */
export const tryCreateCategory = Result.wrap(
	async (payload: Payload, request: Request, args: CreateCategoryArgs) => {
		const { name, parent } = args;

		if (!name) {
			throw new InvalidArgumentError("Category name is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const newCategory = await payload.create({
				collection: CourseCategories.slug,
				data: {
					name,
					parent,
				},
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return newCategory as CourseCategory;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create category", { cause: error }),
);

/**
 * Updates an existing course category
 */
export const tryUpdateCategory = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		categoryId: number,
		args: UpdateCategoryArgs,
	) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const updatedCategory = await payload.update({
				collection: CourseCategories.slug,
				id: categoryId,
				data: args,
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return updatedCategory as CourseCategory;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update category", { cause: error }),
);

/**
 * Deletes a course category
 * Will fail if category has subcategories or courses
 */
export const tryDeleteCategory = Result.wrap(
	async (payload: Payload, request: Request, categoryId: number) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Check for subcategories
			const subcategories = await payload.find({
				collection: CourseCategories.slug,
				where: {
					parent: {
						equals: categoryId,
					},
				},
				limit: 1,
				req: { ...request, transactionID },
			});

			if (subcategories.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete category with subcategories. Delete subcategories first.",
				);
			}

			// Check for courses
			const courses = await payload.find({
				collection: Courses.slug,
				where: {
					category: {
						equals: categoryId,
					},
				},
				limit: 1,
				req: { ...request, transactionID },
			});

			if (courses.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete category with courses. Remove or reassign courses first.",
				);
			}

			const deletedCategory = await payload.delete({
				collection: CourseCategories.slug,
				id: categoryId,
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return deletedCategory;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete category", { cause: error }),
);

/**
 * Finds a category by ID
 */
export const tryFindCategoryById = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const category = await payload.findByID({
			collection: CourseCategories.slug,
			id: categoryId,
			depth: 1,
		});

		return category as CourseCategory;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find category by ID", { cause: error }),
);

/**
 * Gets all categories as a tree structure
 */
export const tryGetCategoryTree = Result.wrap(
	async (payload: Payload) => {
		const allCategories = await payload.find({
			collection: CourseCategories.slug,
			pagination: false,
			depth: 0,
		});

		// Build tree structure
		const categoryMap = new Map<number, CategoryTreeNode>();
		const rootCategories: CategoryTreeNode[] = [];

		// First pass: create all nodes
		for (const cat of allCategories.docs) {
			const directCoursesCountResult = await payload.count({
				collection: Courses.slug,
				where: {
					category: {
						equals: cat.id,
					},
				},
			});

			const directSubcategoriesCountResult = await payload.count({
				collection: CourseCategories.slug,
				where: {
					parent: {
						equals: cat.id,
					},
				},
			});

			const totalNestedCoursesCount = await getTotalNestedCoursesCount(
				payload,
				cat.id,
			);

			const directCoursesCount = directCoursesCountResult.totalDocs;
			const directSubcategoriesCount = directSubcategoriesCountResult.totalDocs;

			const node: CategoryTreeNode = {
				id: cat.id,
				name: cat.name,
				parent:
					typeof cat.parent === "number"
						? cat.parent
						: (cat.parent?.id ?? null),
				directCoursesCount,
				directSubcategoriesCount,
				totalNestedCoursesCount,
				subcategories: [],
			};

			categoryMap.set(cat.id, node);
		}

		// Second pass: build tree
		for (const node of categoryMap.values()) {
			if (node.parent === null) {
				rootCategories.push(node);
			} else {
				const parentNode = categoryMap.get(node.parent);
				if (parentNode) {
					parentNode.subcategories.push(node);
				}
			}
		}

		return rootCategories;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get category tree", { cause: error }),
);

/**
 * Gets all ancestors of a category from root to the category
 */
export const tryGetCategoryAncestors = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const ancestors: CourseCategory[] = [];
		let currentId: number | null = categoryId;

		while (currentId !== null) {
			const category: any = await payload.findByID({
				collection: CourseCategories.slug,
				id: currentId,
				depth: 0,
			});

			ancestors.unshift(category as CourseCategory);

			currentId =
				typeof category.parent === "number"
					? category.parent
					: (category.parent?.id ?? null);
		}

		return ancestors;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get category ancestors", { cause: error }),
);

/**
 * Calculates the depth of a category (0 for root, 1 for first level, etc.)
 */
export const tryGetCategoryDepth = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		let depth = 0;
		let currentId: number | null = categoryId;

		while (currentId !== null) {
			const category: any = await payload.findByID({
				collection: CourseCategories.slug,
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
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate category depth", { cause: error }),
);

/**
 * Gets total count of courses in a category and all its subcategories recursively
 */
export const tryGetTotalNestedCoursesCount = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const count = await getTotalNestedCoursesCount(payload, categoryId);
		return count;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to count nested courses", { cause: error }),
);

/**
 * Helper function to recursively count courses
 */
async function getTotalNestedCoursesCount(
	payload: Payload,
	categoryId: number,
): Promise<number> {
	// Count direct courses
	const directCountResult = await payload.count({
		collection: Courses.slug,
		where: {
			category: {
				equals: categoryId,
			},
		},
	});

	const directCount = directCountResult.totalDocs;

	// Get subcategories
	const subcategories = await payload.find({
		collection: CourseCategories.slug,
		where: {
			parent: {
				equals: categoryId,
			},
		},
		pagination: false,
		depth: 0,
	});

	// Recursively count courses in subcategories
	let nestedCount = 0;
	for (const subcat of subcategories.docs) {
		nestedCount += await getTotalNestedCoursesCount(payload, subcat.id);
	}

	return directCount + nestedCount;
}

/**
 * Finds root-level categories (categories without parents)
 */
export const tryFindRootCategories = Result.wrap(
	async (payload: Payload, limit: number = 100) => {
		const categories = await payload.find({
			collection: CourseCategories.slug,
			where: {
				parent: {
					exists: false,
				},
			},
			limit,
			sort: "name",
		});

		return categories.docs as CourseCategory[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find root categories", { cause: error }),
);

/**
 * Finds direct subcategories of a parent category
 */
export const tryFindSubcategories = Result.wrap(
	async (payload: Payload, parentId: number, limit: number = 100) => {
		if (!parentId) {
			throw new InvalidArgumentError("Parent ID is required");
		}

		const categories = await payload.find({
			collection: CourseCategories.slug,
			where: {
				parent: {
					equals: parentId,
				},
			},
			limit,
			sort: "name",
		});

		return categories.docs as CourseCategory[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find subcategories", { cause: error }),
);

// This page no longer handles action; API route handles reorder

export type FlatNode = {
	id: string; // "c{id}"
	name: string;
	parentId: string | null; // "c{id}" or null
	children?: string[];
	directCoursesCount: number;
	totalNestedCoursesCount: number;
};

export function flattenCategories(
	categories: CategoryTreeNode[],
): Record<string, FlatNode> {
	const flat: Record<string, FlatNode> = {};

	const visit = (node: CategoryTreeNode, parentId: string | null) => {
		const id = `c${node.id}`;
		flat[id] = {
			id,
			name: node.name,
			parentId,
			children: [],
			directCoursesCount: node.directCoursesCount,
			totalNestedCoursesCount: node.totalNestedCoursesCount,
		};
		for (const child of node.subcategories) {
			const childId = `c${child.id}`;
			flat[id].children!.push(childId);
			visit(child, id);
		}
	};

	for (const root of categories) visit(root, null);
	return flat;
}
