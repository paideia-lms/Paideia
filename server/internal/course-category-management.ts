import { CourseCategories, Courses } from "server/payload.config";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { CourseCategory } from "../payload-types";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "./utils/handle-transaction-id";
import {
	Depth,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";

export interface CreateCategoryArgs extends BaseInternalFunctionArgs {
	name: string;
	parent?: number;
}

export interface UpdateCategoryArgs extends BaseInternalFunctionArgs {
	categoryId: number;
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
	async (args: CreateCategoryArgs) => {
		const { payload, name, parent, req } = args;

		if (!name) {
			throw new InvalidArgumentError("Category name is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			const newCategory = await payload.create({
				collection: CourseCategories.slug,
				data: {
					name,
					parent,
				},
				req: transactionInfo.reqWithTransaction,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return newCategory as CourseCategory;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
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
	async (args: UpdateCategoryArgs) => {
		const { payload, categoryId, name, parent, req } = args;

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			const updateData: { name?: string; parent?: number } = {};
			if (name !== undefined) updateData.name = name;
			if (parent !== undefined) updateData.parent = parent;

			const updatedCategory = await payload.update({
				collection: CourseCategories.slug,
				id: categoryId,
				data: updateData,
				req: transactionInfo.reqWithTransaction,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return updatedCategory as CourseCategory;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update category", { cause: error }),
);

export interface DeleteCategoryArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Deletes a course category
 * Will fail if category has subcategories or courses
 */
export const tryDeleteCategory = Result.wrap(
	async (args: DeleteCategoryArgs) => {
		const { payload, categoryId, req } = args;

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

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
				req: transactionInfo.reqWithTransaction,
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
				req: transactionInfo.reqWithTransaction,
			});

			if (courses.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete category with courses. Remove or reassign courses first.",
				);
			}

			const deletedCategory = await payload.delete({
				collection: CourseCategories.slug,
				id: categoryId,
				req: transactionInfo.reqWithTransaction,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return deletedCategory;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete category", { cause: error }),
);

export interface FindCategoryByIdArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Finds a category by ID
 */
export const tryFindCategoryById = Result.wrap(
	async (args: FindCategoryByIdArgs) => {
		const { payload, categoryId, req, overrideAccess = false } = args;

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const category = await payload.findByID({
			collection: CourseCategories.slug,
			id: categoryId,
			depth: 1,
			req,
			overrideAccess,
		});

		return category as CourseCategory;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find category by ID", { cause: error }),
);

export interface GetCategoryTreeArgs extends BaseInternalFunctionArgs {}

/**
 * Gets all categories as a tree structure
 */
export const tryGetCategoryTree = Result.wrap(
	async (args: GetCategoryTreeArgs) => {
		const { payload, req, overrideAccess = false } = args;

		const allCategories = await payload
			.find({
				collection: CourseCategories.slug,
				pagination: false,
				depth: 0,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "find">());

		type CategoryTreeNode = {
			id: number;
			name: string;
			parent: number | null;
			directCoursesCount: number;
			directSubcategoriesCount: number;
			totalNestedCoursesCount: number;
			subcategories: CategoryTreeNode[];
		};

		// Build tree structure
		const categoryMap = new Map<number, CategoryTreeNode>();
		const rootCategories: CategoryTreeNode[] = [];

		// TODO: optimize this, this is for loop in for loop !!!!
		// First pass: create all nodes
		for (const cat of allCategories.docs) {
			const [
				directCoursesCountResult,
				directSubcategoriesCountResult,
				totalNestedCoursesCount,
			] = await Promise.all([
				payload.count({
					collection: Courses.slug,
					where: {
						category: {
							equals: cat.id,
						},
					},
					req,
					overrideAccess,
				}),
				payload.count({
					collection: CourseCategories.slug,
					where: {
						parent: {
							equals: cat.id,
						},
					},
					req,
					overrideAccess,
				}),
				tryGetTotalNestedCoursesCount({
					payload,
					categoryId: cat.id,
					req,
					overrideAccess,
				}).then((result) => result.getOrThrow()),
			]);

			const directCoursesCount = directCoursesCountResult.totalDocs;
			const directSubcategoriesCount = directSubcategoriesCountResult.totalDocs;

			const node = {
				id: cat.id,
				name: cat.name,
				parent: cat.parent ?? null,
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

export interface GetCategoryAncestorsArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Gets all ancestors of a category from root to the category
 */
export const tryGetCategoryAncestors = Result.wrap(
	async (args: GetCategoryAncestorsArgs) => {
		const { payload, categoryId, req, overrideAccess = false } = args;

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

				req,
				overrideAccess,
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

export interface GetCategoryDepthArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Calculates the depth of a category (0 for root, 1 for first level, etc.)
 */
export const tryGetCategoryDepth = Result.wrap(
	async (args: GetCategoryDepthArgs) => {
		const { payload, categoryId, req, overrideAccess = false } = args;

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

				req,
				overrideAccess,
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

export interface GetTotalNestedCoursesCountArgs
	extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Gets total count of courses in a category and all its subcategories recursively
 */
export const tryGetTotalNestedCoursesCount = Result.wrap(
	async (args: GetTotalNestedCoursesCountArgs) => {
		const { payload, categoryId, req, overrideAccess = false } = args;

		// Count direct courses
		const directCountResult = await payload.count({
			collection: Courses.slug,
			where: {
				category: {
					equals: categoryId,
				},
			},
			req,
			overrideAccess,
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
			req,
			overrideAccess,
		});

		// Recursively count courses in subcategories
		let nestedCount = 0;
		for (const subcat of subcategories.docs) {
			const result = await tryGetTotalNestedCoursesCount({
				payload,
				categoryId: subcat.id,

				req,
				overrideAccess,
			});

			if (!result.ok) {
				throw result.error;
			}

			nestedCount += result.value;
		}

		return directCount + nestedCount;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to count nested courses", { cause: error }),
);

export interface FindRootCategoriesArgs extends BaseInternalFunctionArgs {
	limit?: number;
}

/**
 * Finds root-level categories (categories without parents)
 */
export const tryFindRootCategories = Result.wrap(
	async (args: FindRootCategoriesArgs) => {
		const { payload, limit = 100, req, overrideAccess = false } = args;

		const categories = await payload.find({
			collection: CourseCategories.slug,
			where: {
				parent: {
					exists: false,
				},
			},
			limit,
			sort: "name",
			req,
			overrideAccess,
		});

		return categories.docs as CourseCategory[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find root categories", { cause: error }),
);

export interface FindSubcategoriesArgs extends BaseInternalFunctionArgs {
	parentId: number;
	limit?: number;
}

/**
 * Finds direct subcategories of a parent category
 */
export const tryFindSubcategories = Result.wrap(
	async (args: FindSubcategoriesArgs) => {
		const {
			payload,
			parentId,
			limit = 100,
			req,
			overrideAccess = false,
		} = args;

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
			req,
			overrideAccess,
		});

		return categories.docs as CourseCategory[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find subcategories", { cause: error }),
);

// This page no longer handles action; API route handles reorder

export interface FlatNode {
	id: string; // "c{id}"
	name: string;
	parentId: string | null; // "c{id}" or null
	children?: string[];
	directCoursesCount: number;
	totalNestedCoursesCount: number;
}

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
			if (flat[id].children) {
				flat[id].children.push(childId);
			}
			visit(child, id);
		}
	};

	for (const root of categories) visit(root, null);
	return flat;
}
