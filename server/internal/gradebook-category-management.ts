import type { Payload } from "payload";
import { GradebookCategories } from "server/payload.config";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	GradebookCategoryNotFoundError,
	GradebookNotFoundError,
	InvalidSortOrderError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
	WeightExceedsLimitError,
} from "~/utils/error";
import type { GradebookCategory } from "../payload-types";
import { tryGetGradebookJsonRepresentation } from "./gradebook-management";

export interface CreateGradebookCategoryArgs {
	gradebookId: number;
	parentId?: number | null;
	name: string;
	description?: string;
	weight?: number;
	sortOrder: number;
}

export interface UpdateGradebookCategoryArgs {
	name?: string;
	description?: string;
	weight?: number;
	sortOrder?: number;
}

/**
 * Creates a new gradebook category using Payload local API
 */
export const tryCreateGradebookCategory = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: CreateGradebookCategoryArgs,
	) => {
		const {
			gradebookId,
			parentId,
			name,
			description,
			weight = 0,
			sortOrder,
		} = args;

		// Validate weight
		if (weight < 0 || weight > 100) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Validate sort order
		if (sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		// Check if gradebook exists
		const gradebook = await payload.findByID({
			collection: "gradebooks",
			id: gradebookId,
			req: request,
		});

		if (!gradebook) {
			throw new GradebookNotFoundError(
				`Gradebook with ID ${gradebookId} not found`,
			);
		}

		// Check if parent category exists (if provided)
		if (parentId) {
			const parentCategory = await payload.findByID({
				collection: GradebookCategories.slug,
				id: parentId,
				req: request,
			});

			if (!parentCategory) {
				throw new GradebookCategoryNotFoundError(
					`Parent category with ID ${parentId} not found`,
				);
			}

			// Ensure parent belongs to the same gradebook
			const parentGradebook = parentCategory.gradebook;
			assertZodInternal(
				"tryCreateGradebookCategory: Parent gradebook is required",
				parentGradebook,
				z.object({
					id: z.number(),
				}),
			);

			if (parentGradebook.id !== gradebookId) {
				throw new Error("Parent category must belong to the same gradebook");
			}
		}

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const categoryData: {
				gradebook: number;
				parent?: number | null;
				name: string;
				description?: string | null;
				weight: number;
				sortOrder: number;
			} = {
				gradebook: gradebookId,
				name,
				weight,
				sortOrder,
			};

			if (parentId !== undefined) {
				categoryData.parent = parentId;
			}

			if (description !== undefined) {
				categoryData.description = description;
			}

			const newCategory = await payload.create({
				collection: GradebookCategories.slug,
				data: categoryData,
				req: { ...request, transactionID },
			});

			console.log("newCategory", newCategory);

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			// get JSON representation
			const jsonRepresentation = await tryGetGradebookJsonRepresentation(payload, gradebookId);

			console.log("jsonRepresentation", JSON.stringify(jsonRepresentation.value, null, 2));

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const categoryGradebook = newCategory.gradebook;
			assertZodInternal(
				"tryCreateGradebookCategory: Category gradebook is required",
				categoryGradebook,
				z.object({
					id: z.number(),
				}),
			);

			const categoryParent = newCategory.parent;
			assertZodInternal(
				"tryCreateGradebookCategory: Category parent is required",
				categoryParent,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const result = {
				...newCategory,
				gradebook: categoryGradebook,
				parent: categoryParent,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create gradebook category", { cause: error }),
);

/**
 * Updates an existing gradebook category using Payload local API
 */
export const tryUpdateGradebookCategory = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		categoryId: number,
		args: UpdateGradebookCategoryArgs,
	) => {
		// Check if category exists
		const existingCategory = await payload.findByID({
			collection: GradebookCategories.slug,
			id: categoryId,
			req: request,
		});

		if (!existingCategory) {
			throw new GradebookCategoryNotFoundError(
				`Category with ID ${categoryId} not found`,
			);
		}

		// Validate weight if provided
		if (args.weight !== undefined && (args.weight < 0 || args.weight > 100)) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Validate sort order if provided
		if (args.sortOrder !== undefined && args.sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		const updatedCategory = await payload.update({
			collection: GradebookCategories.slug,
			id: categoryId,
			data: args,
			req: request,
		});

		return updatedCategory as GradebookCategory;
	},
	(error) =>
		new Error(
			`Failed to update gradebook category: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a gradebook category by ID
 */
export const tryFindGradebookCategoryById = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		const category = await payload.findByID({
			collection: GradebookCategories.slug,
			id: categoryId,
		});

		if (!category) {
			throw new GradebookCategoryNotFoundError(
				`Category with ID ${categoryId} not found`,
			);
		}

		return category as GradebookCategory;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find gradebook category by ID", { cause: error }),
);

/**
 * Deletes a gradebook category by ID
 */
export const tryDeleteGradebookCategory = Result.wrap(
	async (payload: Payload, request: Request, categoryId: number) => {
		const deletedCategory = await payload.delete({
			collection: GradebookCategories.slug,
			id: categoryId,
			req: request,
		});

		return deletedCategory as GradebookCategory;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete gradebook category", { cause: error }),
);

/**
 * Gets all categories for a gradebook in hierarchical order
 */
export const tryGetGradebookCategoriesHierarchy = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
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
		new UnknownError("Failed to get gradebook categories hierarchy", { cause: error }),
);

/**
 * Gets next available sort order for a category within its parent context
 */
export const tryGetNextSortOrder = Result.wrap(
	async (payload: Payload, gradebookId: number, parentId?: number | null) => {
		const where: any = {
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

/**
 * Reorders categories within a parent context
 */
export const tryReorderCategories = Result.wrap(
	async (payload: Payload, request: Request, categoryIds: number[]) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Update sort order for each category
			for (let i = 0; i < categoryIds.length; i++) {
				await payload.update({
					collection: GradebookCategories.slug,
					id: categoryIds[i],
					data: {
						sortOrder: i,
					},
					req: { ...request, transactionID },
				});
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return { success: true };
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to reorder categories", { cause: error }),
);
