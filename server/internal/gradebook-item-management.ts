import type { Payload, PayloadRequest } from "payload";
import { GradebookItems } from "server/collections/gradebook-items";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	GradebookItemNotFoundError,
	InvalidGradeValueError,
	InvalidSortOrderError,
	transformError,
	UnknownError,
	WeightExceedsLimitError,
} from "~/utils/error";
import type { Enrollment, GradebookItem, UserGrade } from "../payload-types";
import { tryGetGradebookAllRepresentations } from "./gradebook-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type BaseInternalFunctionArgs,
	Depth,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { validateGradebookWeights } from "./utils/validate-gradebook-weights";

export interface ValidateOverallWeightTotalArgs
	extends BaseInternalFunctionArgs {
	courseId: number;
	errorMessagePrefix?: string;
}

export interface CreateGradebookItemArgs extends BaseInternalFunctionArgs {
	courseId: number;
	categoryId?: number | null;
	name: string;
	description?: string;
	activityModuleId?: number | null;
	maxGrade?: number;
	minGrade?: number;
	weight?: number | null;
	extraCredit?: boolean;
	sortOrder: number;
}

export interface UpdateGradebookItemArgs extends BaseInternalFunctionArgs {
	itemId: number;
	name?: string;
	description?: string;
	categoryId?: number | null;
	activityModuleId?: number | null;
	maxGrade?: number;
	minGrade?: number;
	weight?: number | null;
	extraCredit?: boolean;
	sortOrder?: number;
}

export interface DeleteGradebookItemArgs extends BaseInternalFunctionArgs {
	itemId: number;
}

/**
 * Creates a new gradebook item using Payload local API
 */
export const tryCreateGradebookItem = Result.wrap(
	async (args: CreateGradebookItemArgs) => {
		const {
			payload,
			courseId,
			categoryId,
			name,
			description,
			activityModuleId,
			maxGrade = 100,
			minGrade = 0,
			weight,
			extraCredit = false,
			sortOrder,
			req,
			overrideAccess = false,
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
		if (
			weight !== undefined &&
			weight !== null &&
			(weight < 0 || weight > 100)
		) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Validate that extra credit items must have a weight (cannot be null)
		if (extraCredit && (weight === null || weight === undefined)) {
			throw new WeightExceedsLimitError(
				"Extra credit items must have a specified weight (cannot be null or undefined)",
			);
		}

		// Validate sort order
		if (sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			const newItem = await payload
				.create({
					collection: GradebookItems.slug,
					data: {
						gradebook: courseId,
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
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Validate overall weight total after creation
			await tryValidateOverallWeightTotal({
				payload,
				courseId,
				req: reqWithTransaction,
				overrideAccess,
				errorMessagePrefix: "Item creation",
			}).getOrThrow();

			return newItem;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create gradebook item", {
			cause: error,
		}),
);

/**
 * Validates weight distribution at course level and all category levels recursively
 * Rules:
 * 1. Filter away extra credit items from each level
 * 2. If auto-weighted items (weight === null) exist in the level, then total of weight items must be <= 100%
 * 3. If auto-weighted items don't exist in the level, then total weight must equal exactly 100%
 */
export const tryValidateOverallWeightTotal = Result.wrap(
	async (args: ValidateOverallWeightTotalArgs) => {
		const {
			payload,
			courseId,

			req,
			overrideAccess = false,
			errorMessagePrefix = "Operation",
		} = args;

		const allRepsResult = await tryGetGradebookAllRepresentations({
			payload,
			courseId,
			req,
			overrideAccess,
		}).getOrThrow();

		const setup = allRepsResult.ui;

		// Validate weights at course level and all category levels recursively
		validateGradebookWeights(
			setup.gradebook_setup.items,
			"course level",
			null,
			errorMessagePrefix,
		);

		return { baseTotal: setup.totals.baseTotal };
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to validate overall weight total", {
			cause: error,
		}),
);

/**
 * Updates an existing gradebook item using Payload local API
 * After updating weight, validates that the sum of overall weights equals exactly 100%
 */
export const tryUpdateGradebookItem = Result.wrap(
	async (args: UpdateGradebookItemArgs) => {
		const {
			payload,
			itemId,
			name,
			description,
			categoryId,
			activityModuleId,
			maxGrade,
			minGrade,
			weight,
			extraCredit,
			sortOrder,

			req,
			overrideAccess = false,
		} = args;

		// Check if item exists
		const existingItem = await payload
			.findByID({
				collection: GradebookItems.slug,
				id: itemId,
				req,
				overrideAccess,
				depth: 1,
			})
			.then(stripDepth<1, "findByID">());

		if (!existingItem) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		// Validate grade values if provided
		const finalMaxGrade = maxGrade ?? existingItem.maxGrade;
		const finalMinGrade = minGrade ?? existingItem.minGrade;

		if (finalMaxGrade < finalMinGrade) {
			throw new InvalidGradeValueError(
				"Maximum grade must be greater than or equal to minimum grade",
			);
		}

		if (finalMinGrade < 0) {
			throw new InvalidGradeValueError("Minimum grade must be non-negative");
		}

		// Validate weight if provided
		if (
			weight !== undefined &&
			weight !== null &&
			(weight < 0 || weight > 100)
		) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Determine final extra credit value (use provided value or existing value)
		const finalExtraCredit = extraCredit ?? existingItem.extraCredit ?? false;

		// Determine final weight value (use provided value or existing value)
		const finalWeight = weight !== undefined ? weight : existingItem.weight;

		// Validate that extra credit items must have a weight (cannot be null)
		if (
			finalExtraCredit &&
			(finalWeight === null || finalWeight === undefined)
		) {
			throw new WeightExceedsLimitError(
				"Extra credit items must have a specified weight (cannot be null or undefined)",
			);
		}

		// Validate sort order if provided
		if (sortOrder !== undefined && sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		// Get gradebook ID from existing item
		const gradebookId =
			typeof existingItem.gradebook === "number"
				? existingItem.gradebook
				: existingItem.gradebook.id;

		// Build update data, mapping categoryId to category and excluding categoryId
		const updateData: Record<string, unknown> = {};

		if (name !== undefined) {
			updateData.name = name;
		}
		if (description !== undefined) {
			updateData.description = description;
		}
		if (categoryId !== undefined) {
			updateData.category = categoryId;
		}
		if (activityModuleId !== undefined) {
			updateData.activityModule = activityModuleId;
		}
		if (maxGrade !== undefined) {
			updateData.maxGrade = maxGrade;
		}
		if (minGrade !== undefined) {
			updateData.minGrade = minGrade;
		}
		if (weight !== undefined) {
			updateData.weight = weight;
		}
		if (extraCredit !== undefined) {
			updateData.extraCredit = extraCredit;
		}
		if (sortOrder !== undefined) {
			updateData.sortOrder = sortOrder;
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Update the item
			const updatedItem = await payload
				.update({
					collection: GradebookItems.slug,
					id: itemId,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">());

			await tryValidateOverallWeightTotal({
				payload,
				courseId: gradebookId,
				req: reqWithTransaction,
				overrideAccess,
				errorMessagePrefix: "Weight update",
			}).getOrThrow();

			return updatedItem;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to update gradebook item`, {
			cause: error,
		}),
);

interface TryFindGradebookItemByIdArgs extends BaseInternalFunctionArgs {
	itemId: number;
}

/**
 * Finds a gradebook item by ID
 */
export const tryFindGradebookItemById = Result.wrap(
	async (args: TryFindGradebookItemByIdArgs) => {
		const { payload, itemId, req, overrideAccess = false } = args;

		const item = await payload
			.findByID({
				collection: GradebookItems.slug,
				id: itemId,
				depth: 1,
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "findByID">());

		if (!item) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		return item;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find gradebook item by ID", {
			cause: error,
		}),
);

/**
 * Deletes a gradebook item by ID
 * After deletion, validates that the sum of overall weights equals exactly 100%
 */
export const tryDeleteGradebookItem = Result.wrap(
	async (args: DeleteGradebookItemArgs) => {
		const { payload, itemId, req, overrideAccess = false } = args;

		// Check if item exists and get gradebook ID
		const existingItem = await payload
			.findByID({
				collection: GradebookItems.slug,
				id: itemId,
				depth: 0,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryDeleteGradebookItem",
					args,
				});
				throw error;
			});

		if (!existingItem) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		// Get gradebook ID from existing item
		const gradebookId = existingItem.gradebook;

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Delete the item
			const deletedItem = await payload
				.delete({
					collection: GradebookItems.slug,
					id: itemId,
					depth: 0,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<0, "delete">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryDeleteGradebookItem",
						args,
					});
					throw error;
				});

			// After deletion, validate that overall weights sum to exactly 100%
			await tryValidateOverallWeightTotal({
				payload,
				courseId: gradebookId,
				req: reqWithTransaction,
				overrideAccess,
				errorMessagePrefix: "Deletion",
			}).getOrThrow();

			return deletedItem;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete gradebook item", {
			cause: error,
		}),
);
export interface TryGetGradebookItemsInOrderArgs
	extends BaseInternalFunctionArgs {
	gradebookId: number;
}

/**
 * Gets all items for a gradebook in order
 */
export const tryGetGradebookItemsInOrder = Result.wrap(
	async (args: TryGetGradebookItemsInOrderArgs) => {
		const { payload, gradebookId, req, overrideAccess = false } = args;

		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				depth: 1, // Get category and activity module details
				limit: MOCK_INFINITY,
				pagination: false,
				sort: "sortOrder",
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">())
			.then((items) => {
				return items.docs;
			});

		return items;
	},
	(error) =>
		new Error(
			`Failed to get gradebook items in order: ${error instanceof Error ? error.message : String(error)}`,
		),
);

export interface TryGetCategoryItemsArgs extends BaseInternalFunctionArgs {
	categoryId: number;
}

/**
 * Gets items for a specific category
 */
export const tryGetCategoryItems = Result.wrap(
	async (args: TryGetCategoryItemsArgs) => {
		const { payload, categoryId, req, overrideAccess = false } = args;
		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where: {
					category: {
						equals: categoryId,
					},
				},
				depth: 1, // Get activity module details
				limit: 999999,
				sort: "sortOrder",
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">());

		return items.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(
			`Failed to get category items: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);

interface TryGetNextItemSortOrderArgs extends BaseInternalFunctionArgs {
	gradebookId: number;
	categoryId?: number | null;
}

/**
 * Gets next available sort order for an item within its category context
 */
export const tryGetNextItemSortOrder = Result.wrap(
	async (args: TryGetNextItemSortOrderArgs) => {
		const {
			payload,
			gradebookId,
			categoryId,
			req,
			overrideAccess = false,
		} = args;
		const where: {
			gradebook: { equals: number };
			category?: { equals: number | null };
		} = {
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

		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where,
				limit: 1,
				sort: "-sortOrder",
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">());

		const lastItem = items.docs[0];

		if (!lastItem) {
			return 0; // First item
		}
		return lastItem.sortOrder + 1;
	},
	(error) =>
		new Error(
			`Failed to get next item sort order: ${error instanceof Error ? error.message : String(error)}`,
		),
);

export interface TryReorderItemsArgs extends BaseInternalFunctionArgs {
	itemIds: number[];
}

/**
 * Reorders items within a category context
 */
export const tryReorderItems = Result.wrap(
	async (args: TryReorderItemsArgs) => {
		const { payload, req, overrideAccess = false, itemIds } = args;
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Update sort order for each item using Promise.all for concurrent updates
			await Promise.all(
				itemIds.map((itemId, i) =>
					payload
						.update({
							collection: GradebookItems.slug,
							id: itemId,
							data: {
								sortOrder: i,
							},
							req: reqWithTransaction,
							overrideAccess,
							depth: 1,
						})
						.then(stripDepth<1, "update">()),
				),
			);

			return { success: true };
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError(
			`Failed to reorder items: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);

interface TryGetItemsWithUserGradesArgs extends BaseInternalFunctionArgs {
	gradebookId: number;
	enrollmentId: number;
}

/**
 * Gets items with their grades for a specific enrollment
 */
export const tryGetItemsWithUserGrades = Result.wrap(
	async (args: TryGetItemsWithUserGradesArgs) => {
		const {
			payload,
			gradebookId,
			enrollmentId,
			req,
			overrideAccess = false,
		} = args;
		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				joins: {
					userGrades: {
						limit: MOCK_INFINITY,
					},
				},
				depth: 2, // Get user grades
				limit: MOCK_INFINITY,
				pagination: false,
				sort: "sortOrder",
				req,
				overrideAccess,
			})
			.then(stripDepth<2, "find">())
			.then((items) => {
				return items.docs.map((item) => {
					const userGrades = item.userGrades?.docs;

					const result = {
						...item,
						userGrades: userGrades ?? [],
					};
					return result;
				});
			});

		// Filter items to only include those with grades for the specific enrollment
		const itemsWithGrades = items.filter((item) => {
			const gradebookItem = item;
			// console.log("gradebookItem.userGrades", gradebookItem.userGrades);
			return gradebookItem.userGrades?.some((grade) => {
				// ?? not sure
				return grade.enrollment === enrollmentId;
			});
		});

		return itemsWithGrades;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(
			`Failed to get items with user grades: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);

export interface FindGradebookItemByCourseModuleLinkArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
}

/**
 * Finds a gradebook item by course module link (course-activity-module-link)
 */
export const tryFindGradebookItemByCourseModuleLink = Result.wrap(
	async (args: FindGradebookItemByCourseModuleLinkArgs) => {
		const { payload, req, overrideAccess = false, courseModuleLinkId } = args;

		const items = await payload
			.find({
				collection: GradebookItems.slug,
				where: {
					activityModule: {
						equals: courseModuleLinkId,
					},
				},
				limit: 1,
				depth: 1,
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">());

		const item = items.docs[0];

		if (!item) {
			throw new GradebookItemNotFoundError(
				`Gradebook item not found for course module link ${courseModuleLinkId}`,
			);
		}

		return item;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(
			`Failed to find gradebook item by course module link: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);
