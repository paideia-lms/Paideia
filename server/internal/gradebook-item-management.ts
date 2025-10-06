import type { Payload } from "payload";
import { GradebookItems } from "server/payload.config";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	GradebookCategoryNotFoundError,
	GradebookItemNotFoundError,
	GradebookNotFoundError,
	InvalidGradeValueError,
	InvalidSortOrderError,
	TransactionIdNotFoundError,
	WeightExceedsLimitError,
} from "~/utils/error";
import type { Enrollment, GradebookItem, UserGrade } from "../payload-types";

export interface CreateGradebookItemArgs {
	gradebookId: number;
	categoryId?: number | null;
	name: string;
	description?: string;
	activityModuleId?: number | null;
	maxGrade?: number;
	minGrade?: number;
	weight?: number;
	extraCredit?: boolean;
	sortOrder: number;
}

export interface UpdateGradebookItemArgs {
	name?: string;
	description?: string;
	activityModuleId?: number | null;
	maxGrade?: number;
	minGrade?: number;
	weight?: number;
	extraCredit?: boolean;
	sortOrder?: number;
}

/**
 * Creates a new gradebook item using Payload local API
 */
export const tryCreateGradebookItem = Result.wrap(
	async (payload: Payload, request: Request, args: CreateGradebookItemArgs) => {
		const {
			gradebookId,
			categoryId,
			name,
			description,
			activityModuleId,
			maxGrade = 100,
			minGrade = 0,
			weight = 0,
			extraCredit = false,
			sortOrder,
		} = args;

		// Validate grade values
		if (maxGrade < minGrade) {
			throw new InvalidGradeValueError(
				"Maximum grade must be greater than or equal to minimum grade",
			);
		}

		if (minGrade < 0) {
			throw new InvalidGradeValueError("Minimum grade must be non-negative");
		}

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

		// Check if category exists (if provided)
		if (categoryId) {
			const category = await payload.findByID({
				collection: "gradebook-categories",
				id: categoryId,
				req: request,
			});

			if (!category) {
				throw new GradebookCategoryNotFoundError(
					`Category with ID ${categoryId} not found`,
				);
			}

			// Ensure category belongs to the same gradebook
			const categoryGradebook = category.gradebook;
			assertZod(
				categoryGradebook,
				z.object({
					id: z.number(),
				}),
			);

			if (categoryGradebook.id !== gradebookId) {
				throw new Error("Category must belong to the same gradebook");
			}
		}

		// Check if activity module exists (if provided)
		if (activityModuleId) {
			const activityModule = await payload.findByID({
				collection: "course-activity-module-commit-links",
				id: activityModuleId,
				req: request,
			});

			if (!activityModule) {
				throw new Error(
					`Activity module with ID ${activityModuleId} not found`,
				);
			}
		}

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const newItem = await payload.create({
				collection: GradebookItems.slug,
				data: {
					gradebook: gradebookId,
					category: categoryId,
					name,
					description,
					activityModule: activityModuleId,
					maxGrade,
					minGrade,
					weight,
					extraCredit,
					sortOrder,
				},
				req: { ...request, transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const itemGradebook = newItem.gradebook;
			assertZod(
				itemGradebook,
				z.object({
					id: z.number(),
				}),
			);

			const itemCategory = newItem.category;
			assertZod(
				itemCategory,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const itemActivityModule = newItem.activityModule;
			assertZod(
				itemActivityModule,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const result = {
				...newItem,
				gradebook: itemGradebook,
				category: itemCategory,
				activityModule: itemActivityModule,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		new Error(
			`Failed to create gradebook item: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Updates an existing gradebook item using Payload local API
 */
export const tryUpdateGradebookItem = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		itemId: number,
		args: UpdateGradebookItemArgs,
	) => {
		// Check if item exists
		const existingItem = await payload.findByID({
			collection: GradebookItems.slug,
			id: itemId,
			req: request,
		});

		if (!existingItem) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		// Validate grade values if provided
		const maxGrade = args.maxGrade ?? existingItem.maxGrade;
		const minGrade = args.minGrade ?? existingItem.minGrade;

		if (maxGrade < minGrade) {
			throw new InvalidGradeValueError(
				"Maximum grade must be greater than or equal to minimum grade",
			);
		}

		if (minGrade < 0) {
			throw new InvalidGradeValueError("Minimum grade must be non-negative");
		}

		// Validate weight if provided
		if (args.weight !== undefined && (args.weight < 0 || args.weight > 100)) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Validate sort order if provided
		if (args.sortOrder !== undefined && args.sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		// Check if activity module exists (if being updated)
		if (args.activityModuleId !== undefined && args.activityModuleId !== null) {
			const activityModule = await payload.findByID({
				collection: "course-activity-module-commit-links",
				id: args.activityModuleId,
				req: request,
			});

			if (!activityModule) {
				throw new Error(
					`Activity module with ID ${args.activityModuleId} not found`,
				);
			}
		}

		const updatedItem = await payload.update({
			collection: GradebookItems.slug,
			id: itemId,
			data: args,
			req: request,
		});

		return updatedItem as GradebookItem;
	},
	(error) =>
		new Error(
			`Failed to update gradebook item: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a gradebook item by ID
 */
export const tryFindGradebookItemById = Result.wrap(
	async (payload: Payload, itemId: number) => {
		const item = await payload.findByID({
			collection: GradebookItems.slug,
			id: itemId,
		});

		if (!item) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		return item as GradebookItem;
	},
	(error) =>
		new Error(
			`Failed to find gradebook item by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a gradebook item by ID
 */
export const tryDeleteGradebookItem = Result.wrap(
	async (payload: Payload, request: Request, itemId: number) => {
		const deletedItem = await payload.delete({
			collection: GradebookItems.slug,
			id: itemId,
			req: request,
		});

		return deletedItem as GradebookItem;
	},
	(error) =>
		new Error(
			`Failed to delete gradebook item: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets all items for a gradebook in order
 */
export const tryGetGradebookItemsInOrder = Result.wrap(
	async (payload: Payload, gradebookId: number) => {
		const items = await payload.find({
			collection: GradebookItems.slug,
			where: {
				gradebook: {
					equals: gradebookId,
				},
			},
			depth: 1, // Get category and activity module details
			limit: 999999,
			sort: "sortOrder",
		});

		return items.docs as GradebookItem[];
	},
	(error) =>
		new Error(
			`Failed to get gradebook items in order: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets items for a specific category
 */
export const tryGetCategoryItems = Result.wrap(
	async (payload: Payload, categoryId: number) => {
		const items = await payload.find({
			collection: GradebookItems.slug,
			where: {
				category: {
					equals: categoryId,
				},
			},
			depth: 1, // Get activity module details
			limit: 999999,
			sort: "sortOrder",
		});

		return items.docs as GradebookItem[];
	},
	(error) =>
		new Error(
			`Failed to get category items: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets next available sort order for an item within its category context
 */
export const tryGetNextItemSortOrder = Result.wrap(
	async (payload: Payload, gradebookId: number, categoryId?: number | null) => {
		const where: any = {
			gradebook: {
				equals: gradebookId,
			},
		};

		if (categoryId === null || categoryId === undefined) {
			where.category = {
				equals: null,
			};
		} else {
			where.category = {
				equals: categoryId,
			};
		}

		const items = await payload.find({
			collection: GradebookItems.slug,
			where,
			limit: 1,
			sort: "-sortOrder",
		});

		if (items.docs.length === 0) {
			return 0; // First item
		}

		const lastItem = items.docs[0] as GradebookItem;
		return lastItem.sortOrder + 1;
	},
	(error) =>
		new Error(
			`Failed to get next item sort order: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Reorders items within a category context
 */
export const tryReorderItems = Result.wrap(
	async (payload: Payload, request: Request, itemIds: number[]) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Update sort order for each item
			for (let i = 0; i < itemIds.length; i++) {
				await payload.update({
					collection: GradebookItems.slug,
					id: itemIds[i],
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
		new Error(
			`Failed to reorder items: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets items with their grades for a specific enrollment
 */
export const tryGetItemsWithUserGrades = Result.wrap(
	async (payload: Payload, gradebookId: number, enrollmentId: number) => {
		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				depth: 2, // Get user grades
				limit: 999999,
				pagination: false,
				sort: "sortOrder",
			})
			.then((items) => {
				////////////////////////////////////////////////////
				// type narrowing
				////////////////////////////////////////////////////

				return items.docs.map((item) => {
					const userGrades = item.userGrades?.docs;
					// user grade should be object
					assertZod(
						userGrades,
						z.array(
							z.object({
								id: z.number(),
								enrollment: z.object({
									id: z.number(),
								}),
							}),
						),
					);

					const result = {
						...item,
						userGrades: userGrades as (Omit<UserGrade, "enrollment"> & {
							enrollment: Enrollment;
						})[],
					};
					return result;
				});
			});

		// Filter items to only include those with grades for the specific enrollment
		const itemsWithGrades = items.filter((item) => {
			const gradebookItem = item;
			return gradebookItem.userGrades?.some((grade) => {
				return grade.enrollment?.id === enrollmentId;
			});
		});

		return itemsWithGrades as GradebookItem[];
	},
	(error) =>
		new Error(
			`Failed to get items with user grades: ${error instanceof Error ? error.message : String(error)}`,
		),
);
