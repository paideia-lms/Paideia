import { GradebookItems } from "server/collections/gradebook-items";
import { GradebookCategories } from "../collections/gradebook-categories";
import { Result } from "typescript-result";
import {
	GradebookCategoryNotFoundError,
	GradebookNotFoundError,
	InvalidArgumentError,
	InvalidSortOrderError,
	transformError,
	UnknownError,
	WeightExceedsLimitError,
} from "~/utils/error";
import type { GradebookCategory } from "../payload-types";
import { tryValidateOverallWeightTotal } from "./gradebook-item-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	interceptPayloadError,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";

export interface CreateGradebookCategoryArgs extends BaseInternalFunctionArgs {
	gradebookId: number;
	parentId?: number | null;
	name: string;
	description?: string;
	sortOrder: number;
}

export interface UpdateGradebookCategoryArgs extends BaseInternalFunctionArgs {
	categoryId: number;
	name?: string;
	description?: string;
	weight?: number | null;
	sortOrder?: number;
	extraCredit?: boolean;
}

export interface DeleteGradebookCategoryArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

export interface ValidateNoSubItemAndCategoryArgs
	extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Creates a new gradebook category using Payload local API
 */
export function tryCreateGradebookCategory(args: CreateGradebookCategoryArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				gradebookId,
				parentId,
				name,
				description,
				sortOrder,

				req,
				overrideAccess = false,
			} = args;

			// Validate sort order
			if (sortOrder < 0) {
				throw new InvalidSortOrderError("Sort order must be non-negative");
			}

			// Check if gradebook exists
			const gradebook = await payload
				.findByID({
					collection: "gradebooks",
					id: gradebookId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!gradebook) {
				throw new GradebookNotFoundError(
					`Gradebook with ID ${gradebookId} not found`,
				);
			}

			// Check if parent category exists (if provided)
			if (parentId) {
				const parentCategory = await payload
					.findByID({
						collection: GradebookCategories.slug,
						id: parentId,
						req,
						overrideAccess,
						depth: 1,
					})
					.then(stripDepth<1, "findByID">());

				if (!parentCategory) {
					throw new GradebookCategoryNotFoundError(
						`Parent category with ID ${parentId} not found`,
					);
				}

				// Ensure parent belongs to the same gradebook
				const parentGradebook = parentCategory.gradebook;

				if (parentGradebook.id !== gradebookId) {
					throw new Error("Parent category must belong to the same gradebook");
				}
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newCategory = await payload
					.create({
						collection: GradebookCategories.slug,
						data: {
							gradebook: gradebookId,
							name,
							weight: null,
							extraCredit: false,
							sortOrder,
							parent: parentId ? parentId : null,
							description,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 1,
					})
					.then(stripDepth<1, "create">());

				// Note: We don't validate overall weight total for categories because:
				// 1. Categories don't directly contribute to overall weight - only their child items do
				// 2. It's valid to have a category with no items (0% total) as an intermediate state
				// 3. Validation will happen when items are created/updated, which is when overall weight matters

				// get JSON representation
				// const jsonRepresentation = await tryGetGradebookJsonRepresentation(
				// 	payload,
				// 	gradebookId,
				// );

				// console.log(
				// 	"jsonRepresentation",
				// 	JSON.stringify(jsonRepresentation.value, null, 2),
				// );

				////////////////////////////////////////////////////
				// type narrowing
				////////////////////////////////////////////////////

				return newCategory;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create gradebook category", { cause: error }),
	);
}

/**
 * Updates an existing gradebook category using Payload local API
 * After updating weight, validates that the sum of overall weights equals exactly 100%
 */
export function tryUpdateGradebookCategory(args: UpdateGradebookCategoryArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				categoryId,
				name,
				description,
				weight,
				sortOrder,
				extraCredit,

				req,
				overrideAccess = false,
			} = args;

			// Check if category exists
			const existingCategory = await payload
				.findByID({
					collection: GradebookCategories.slug,
					id: categoryId,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">());

			if (!existingCategory) {
				throw new GradebookCategoryNotFoundError(
					`Category with ID ${categoryId} not found`,
				);
			}

			// Get gradebook ID from existing category
			const gradebookId =
				typeof existingCategory.gradebook === "number"
					? existingCategory.gradebook
					: existingCategory.gradebook.id;

			// Validate weight if provided
			if (
				weight !== undefined &&
				weight !== null &&
				(weight < 0 || weight > 100)
			) {
				throw new WeightExceedsLimitError("Weight must be between 0 and 100");
			}

			// Validate sort order if provided
			if (sortOrder !== undefined && sortOrder < 0) {
				throw new InvalidSortOrderError("Sort order must be non-negative");
			}

			// Validate that extra credit categories must have a weight
			if (extraCredit === true) {
				const finalWeight =
					weight !== undefined ? weight : existingCategory.weight;
				if (finalWeight === null) {
					throw new InvalidArgumentError(
						"Extra credit categories must have a weight specified. Please set a weight before marking the category as extra credit.",
					);
				}
			}

			// Check if category has items by checking existing category weight
			// If weight is 0, the category has no items (categories start with weight 0 and only get weight when they have items)
			const hasItems =
				existingCategory.items?.docs && existingCategory.items.docs.length > 0;

			// If category has no items and weight is being updated to something other than 0, throw error
			if (weight !== undefined && !hasItems) {
				if (weight !== null && weight !== 0) {
					throw new InvalidArgumentError(
						"Cannot update category weight when category has no items. Weight must be 0 for empty categories.",
					);
				}
			}

			// Build update data
			const updateData: Record<string, unknown> = {};
			if (name !== undefined) {
				updateData.name = name;
			}
			if (description !== undefined) {
				updateData.description = description;
			}
			if (weight !== undefined) {
				updateData.weight = weight;
			}
			if (sortOrder !== undefined) {
				updateData.sortOrder = sortOrder;
			}
			if (extraCredit !== undefined) {
				updateData.extraCredit = extraCredit;
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Update the category
				const updatedCategory = await payload
					.update({
						collection: GradebookCategories.slug,
						id: categoryId,
						data: updateData,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				// Check if weight is being updated - if so, we need to validate overall weights
				const isWeightUpdate = weight !== updatedCategory.weight;
				const isExtraCreditUpdate = extraCredit !== updatedCategory.extraCredit;

				if (isWeightUpdate || isExtraCreditUpdate) {
					const validateResult = await tryValidateOverallWeightTotal({
						payload,
						courseId: gradebookId,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						errorMessagePrefix: "Category weight update",
					});

					if (!validateResult.ok) {
						throw validateResult.error;
					}
				}

				return updatedCategory as GradebookCategory;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update gradebook category", {
				cause: error,
			}),
	);
}

type TryFindGradebookCategoryByIdArgs = BaseInternalFunctionArgs & {
	categoryId: number;
};

/**
 * Finds a gradebook category by ID
 */
export function tryFindGradebookCategoryById(
	args: TryFindGradebookCategoryByIdArgs,
) {
	return Result.try(
		async () => {
			const { payload, categoryId, req, overrideAccess = false } = args;

			const category = await payload
				.findByID({
					collection: GradebookCategories.slug,
					id: categoryId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: `tryFindGradebookCategoryById - to find gradebook category by ID ${categoryId}`,
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return category;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find gradebook category by ID", {
				cause: error,
			}),
	);
}

/**
 * Validates that a category has no subcategories and no items
 */
export function tryValidateNoSubItemAndCategory(
	args: ValidateNoSubItemAndCategoryArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				categoryId,

				req,
				overrideAccess = false,
			} = args;

			// Check if category has subcategories
			const subcategories = await payload.find({
				collection: GradebookCategories.slug,
				where: {
					parent: {
						equals: categoryId,
					},
				},
				limit: 1,
				req,
				overrideAccess,
			});

			if (subcategories.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete category that has subcategories. Please delete or move subcategories first.",
				);
			}

			// Check if category has items
			const items = await payload.find({
				collection: GradebookItems.slug,
				where: {
					category: {
						equals: categoryId,
					},
				},
				limit: 1,
				req,
				overrideAccess,
			});

			if (items.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete category that has gradebook items. Please delete or move items first.",
				);
			}

			return { categoryId };
		},
		(error) =>
			transformError(error) ??
			new UnknownError(
				"Failed to validate category has no subcategories or items",
				{
					cause: error,
				},
			),
	);
}

/**
 * Deletes a gradebook category by ID
 * Validates that the category has no items or subcategories before deletion
 * After deletion, validates that the sum of overall weights equals exactly 100%
 */
export function tryDeleteGradebookCategory(args: DeleteGradebookCategoryArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				categoryId,

				req,
				overrideAccess = false,
			} = args;

			// Check if category exists and get gradebook ID
			const existingCategory = await payload.findByID({
				collection: GradebookCategories.slug,
				id: categoryId,
				req,
				overrideAccess,
			});

			if (!existingCategory) {
				throw new GradebookCategoryNotFoundError(
					`Category with ID ${categoryId} not found`,
				);
			}

			// Get gradebook ID from existing category
			const gradebookId =
				typeof existingCategory.gradebook === "number"
					? existingCategory.gradebook
					: existingCategory.gradebook.id;

			// Validate that category has no subcategories and no items
			const validateResult = await tryValidateNoSubItemAndCategory({
				payload,
				categoryId,
				req,
				overrideAccess,
			});

			if (!validateResult.ok) {
				throw validateResult.error;
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Delete the category
				const deletedCategory = await payload.delete({
					collection: GradebookCategories.slug,
					id: categoryId,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// After deletion, validate that overall weights sum to exactly 100%
				const validateResult = await tryValidateOverallWeightTotal({
					payload,
					courseId: gradebookId,
					req: txInfo.reqWithTransaction,
					overrideAccess,
					errorMessagePrefix: "Category deletion",
				});

				if (!validateResult.ok) {
					throw validateResult.error;
				}

				return deletedCategory as GradebookCategory;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete gradebook category", {
				cause: error,
			}),
	);
}

export interface GetGradebookCategoriesHierarchyArgs
	extends BaseInternalFunctionArgs {
	gradebookId: number;
}

/**
 * Gets all categories for a gradebook in hierarchical order
 */
export function tryGetGradebookCategoriesHierarchy(
	args: GetGradebookCategoriesHierarchyArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				gradebookId,

				req,
				overrideAccess = false,
			} = args;

			const categories = await payload.find({
				collection: GradebookCategories.slug,
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				depth: 2, // Get subcategories and items
				limit: 999999,
				sort: "sortOrder",
				req,
				overrideAccess,
			});

			// Build hierarchy
			const categoryMap = new Map<
				number,
				GradebookCategory & { children: GradebookCategory[] }
			>();
			const rootCategories: (GradebookCategory & {
				children: GradebookCategory[];
			})[] = [];

			// First pass: create map and initialize children arrays
			categories.docs.forEach((category) => {
				const cat = category as GradebookCategory;
				categoryMap.set(cat.id, { ...cat, children: [] });
			});

			// Second pass: build hierarchy
			categories.docs.forEach((category) => {
				const cat = category as GradebookCategory;
				const categoryWithChildren = categoryMap.get(cat.id);
				if (!categoryWithChildren) return;

				if (cat.parent) {
					const parentId =
						typeof cat.parent === "number" ? cat.parent : cat.parent.id;
					const parent = categoryMap.get(parentId);
					if (parent) {
						parent.children.push(categoryWithChildren);
					}
				} else {
					rootCategories.push(categoryWithChildren);
				}
			});

			return rootCategories;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get gradebook categories hierarchy", {
				cause: error,
			}),
	);
}

export interface GetNextSortOrderArgs extends BaseInternalFunctionArgs {
	gradebookId: number;
	parentId?: number | null;
}

/**
 * Gets next available sort order for a category within its parent context
 */
export function tryGetNextSortOrder(args: GetNextSortOrderArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				gradebookId,
				parentId,

				req,
				overrideAccess = false,
			} = args;

			const where: {
				gradebook: { equals: number };
				parent?: { equals: number | null };
			} = {
				gradebook: {
					equals: gradebookId,
				},
			};

			if (parentId === null || parentId === undefined) {
				where.parent = {
					equals: null,
				};
			} else {
				where.parent = {
					equals: parentId,
				};
			}

			const categories = await payload.find({
				collection: GradebookCategories.slug,
				where,
				limit: 1,
				sort: "-sortOrder",
				req,
				overrideAccess,
			});

			if (categories.docs.length === 0) {
				return 0; // First item
			}

			const lastCategory = categories.docs[0] as GradebookCategory;
			return lastCategory.sortOrder + 1;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get next sort order", { cause: error }),
	);
}

export interface ReorderCategoriesArgs extends BaseInternalFunctionArgs {
	categoryIds: number[];
}

/**
 * Reorders categories within a parent context
 */
export function tryReorderCategories(args: ReorderCategoriesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				categoryIds,

				req,
				overrideAccess = false,
			} = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Update sort order for each category
				for (let i = 0; i < categoryIds.length; i++) {
					await payload.update({
						collection: GradebookCategories.slug,
						id: categoryIds[i]!,
						data: {
							sortOrder: i,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
					});
				}

				return { success: true };
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder categories", { cause: error }),
	);
}
