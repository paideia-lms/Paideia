import type { Payload, PayloadRequest, TypedUser } from "payload";
import { GradebookItems } from "server/collections/gradebook-items";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	GradebookItemNotFoundError,
	InvalidGradeValueError,
	InvalidSortOrderError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
	WeightExceedsLimitError,
} from "~/utils/error";
import { tryGetGradebookAllRepresentations } from "./gradebook-management";
import { validateGradebookWeights } from "./utils/validate-gradebook-weights";
import type {
	Enrollment,
	GradebookItem,
	User,
	UserGrade,
} from "../payload-types";

export interface ValidateOverallWeightTotalArgs {
	payload: Payload;
	courseId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	errorMessagePrefix?: string;
}

export interface CreateGradebookItemArgs {
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
	transactionID?: string | number; // Optional transaction ID for nested transactions
}

export interface UpdateGradebookItemArgs {
	payload: Payload;
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
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteGradebookItemArgs {
	payload: Payload;
	itemId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Creates a new gradebook item using Payload local API
 */
export const tryCreateGradebookItem = Result.wrap(
	async (payload: Payload, request: Request, args: CreateGradebookItemArgs) => {
		const {
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
		if (weight !== undefined && weight !== null && (weight < 0 || weight > 100)) {
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

		const transactionID =
			args.transactionID || (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		const reqWithTransaction: Partial<PayloadRequest> = {
			...request,
			transactionID,
		};

		try {
			const newItem = await payload.create({
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
			});

			// Validate overall weight total after creation
			const validateResult = await tryValidateOverallWeightTotal({
				payload,
				courseId,
				user: null,
				req: reqWithTransaction,
				overrideAccess: true,
				errorMessagePrefix: "Item creation",
			});

			if (!validateResult.ok) {
				throw validateResult.error;
			}

			// Only commit transaction if we started it (not if it was provided)
			if (!args.transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const itemGradebook = newItem.gradebook;
			assertZodInternal(
				"tryCreateGradebookItem: Item gradebook is required",
				itemGradebook,
				z.object({
					id: z.number(),
				}),
			);

			const itemCategory = newItem.category;
			assertZodInternal(
				"tryCreateGradebookItem: Item category is required",
				itemCategory,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const itemActivityModule = newItem.activityModule;
			assertZodInternal(
				"tryCreateGradebookItem: Item activity module is required",
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
			// Only rollback transaction if we started it (not if it was provided)
			if (!args.transactionID) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
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
			user = null,
			req,
			overrideAccess = false,
			errorMessagePrefix = "Operation",
		} = args;

		const allRepsResult = await tryGetGradebookAllRepresentations({
			payload,
			courseId,
			user,
			req,
			overrideAccess,
		});

		if (!allRepsResult.ok) {
			throw allRepsResult.error;
		}

		const setup = allRepsResult.value.ui;

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
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Check if item exists
		const existingItem = await payload.findByID({
			collection: GradebookItems.slug,
			id: itemId,
			user,
			req,
			overrideAccess,
		});

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
		if (weight !== undefined && weight !== null && (weight < 0 || weight > 100)) {
			throw new WeightExceedsLimitError("Weight must be between 0 and 100");
		}

		// Determine final extra credit value (use provided value or existing value)
		const finalExtraCredit = extraCredit ?? existingItem.extraCredit ?? false;

		// Determine final weight value (use provided value or existing value)
		const finalWeight = weight !== undefined ? weight : existingItem.weight;

		// Validate that extra credit items must have a weight (cannot be null)
		if (finalExtraCredit && (finalWeight === null || finalWeight === undefined)) {
			throw new WeightExceedsLimitError(
				"Extra credit items must have a specified weight (cannot be null or undefined)",
			);
		}

		// Validate sort order if provided
		if (sortOrder !== undefined && sortOrder < 0) {
			throw new InvalidSortOrderError("Sort order must be non-negative");
		}

		// Check if activity module exists (if being updated)
		// if (args.activityModuleId !== undefined && args.activityModuleId !== null) {
		// 	const activityModule = await payload.findByID({
		// 		collection: CourseActivityModuleLinks.slug,
		// 		id: args.activityModuleId,
		// 		req: request,
		// 	});

		// 	if (!activityModule) {
		// 		throw new Error(
		// 			`Activity module with ID ${args.activityModuleId} not found`,
		// 		);
		// 	}
		// }

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

		// Use existing transaction if provided, otherwise create a new one
		const transactionWasProvided = !!req?.transactionID;
		const transactionID =
			req?.transactionID ?? (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		const reqWithTransaction: Partial<PayloadRequest> = req
			? { ...req, transactionID }
			: { transactionID };

		try {
			// Update the item
			const updatedItem = await payload.update({
				collection: GradebookItems.slug,
				id: itemId,
				data: updateData,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			const validateResult = await tryValidateOverallWeightTotal({
				payload,
				courseId: gradebookId,
				user,
				req: reqWithTransaction,
				overrideAccess,
				errorMessagePrefix: "Weight update",
			});

			if (!validateResult.ok) {
				throw validateResult.error;
			}

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return updatedItem as GradebookItem;
		} catch (error) {
			// Rollback transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError(`Failed to update gradebook item`, {
			cause: error,
		}),
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
 * After deletion, validates that the sum of overall weights equals exactly 100%
 */
export const tryDeleteGradebookItem = Result.wrap(
	async (args: DeleteGradebookItemArgs) => {
		const {
			payload,
			itemId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Check if item exists and get gradebook ID
		const existingItem = await payload.findByID({
			collection: GradebookItems.slug,
			id: itemId,
			user,
			req,
			overrideAccess,
		});

		if (!existingItem) {
			throw new GradebookItemNotFoundError(`Item with ID ${itemId} not found`);
		}

		// Get gradebook ID from existing item
		const gradebookId =
			typeof existingItem.gradebook === "number"
				? existingItem.gradebook
				: existingItem.gradebook.id;

		// Use existing transaction if provided, otherwise create a new one
		const transactionWasProvided = !!req?.transactionID;
		const transactionID =
			req?.transactionID ?? (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		const reqWithTransaction: Partial<PayloadRequest> = req
			? { ...req, transactionID }
			: { transactionID };

		try {
			// Delete the item
			const deletedItem = await payload.delete({
				collection: GradebookItems.slug,
				id: itemId,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// After deletion, validate that overall weights sum to exactly 100%
			const validateResult = await tryValidateOverallWeightTotal({
				payload,
				courseId: gradebookId,
				user,
				req: reqWithTransaction,
				overrideAccess,
				errorMessagePrefix: "Deletion",
			});

			if (!validateResult.ok) {
				throw validateResult.error;
			}

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return deletedItem as GradebookItem;
		} catch (error) {
			// Rollback transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete gradebook item", {
			cause: error,
		}),
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
		transformError(error) ??
		new UnknownError(
			`Failed to get category items: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);

/**
 * Gets next available sort order for an item within its category context
 */
export const tryGetNextItemSortOrder = Result.wrap(
	async (payload: Payload, gradebookId: number, categoryId?: number | null) => {
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
		transformError(error) ??
		new UnknownError(
			`Failed to reorder items: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
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
					assertZodInternal(
						"tryGetItemsWithUserGrades: User grades is required",
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
		transformError(error) ??
		new UnknownError(
			`Failed to get items with user grades: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		),
);

export interface FindGradebookItemByCourseModuleLinkArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseModuleLinkId: number;
}

/**
 * Finds a gradebook item by course module link (course-activity-module-link)
 */
export const tryFindGradebookItemByCourseModuleLink = Result.wrap(
	async (args: FindGradebookItemByCourseModuleLinkArgs) => {
		const {
			payload,
			user,
			req,
			overrideAccess = false,
			courseModuleLinkId,
		} = args;

		const items = await payload.find({
			collection: GradebookItems.slug,
			where: {
				activityModule: {
					equals: courseModuleLinkId,
				},
			},
			limit: 1,
			user,
			req,
			overrideAccess,
		});

		if (items.docs.length === 0) {
			throw new GradebookItemNotFoundError(
				`Gradebook item not found for course module link ${courseModuleLinkId}`,
			);
		}

		return items.docs[0] as GradebookItem;
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
