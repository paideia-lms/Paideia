import type { Payload } from "payload";
import { UserGrades } from "server/payload.config";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	GradebookItemNotFoundError,
	InvalidGradeValueError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
	UserGradeNotFoundError,
} from "~/utils/error";
import type { UserGrade } from "../payload-types";

export interface CreateUserGradeArgs {
	userId: number;
	gradebookItemId: number;
	grade?: number | null;
	feedback?: string;
	status?: "not_graded" | "graded" | "excused" | "missing";
	gradedBy?: number;
	submittedAt?: string;
}

export interface UpdateUserGradeArgs {
	grade?: number | null;
	feedback?: string;
	status?: "not_graded" | "graded" | "excused" | "missing";
	gradedBy?: number;
	submittedAt?: string;
}

export interface SearchUserGradesArgs {
	userId?: number;
	gradebookItemId?: number;
	status?: "not_graded" | "graded" | "excused" | "missing";
	gradedBy?: number;
	limit?: number;
	page?: number;
}

export interface BulkGradeUpdateArgs {
	userId: number;
	grades: Array<{
		gradebookItemId: number;
		grade?: number | null;
		feedback?: string;
		status?: "not_graded" | "graded" | "excused" | "missing";
		submittedAt?: string;
	}>;
	gradedBy: number;
}

/**
 * Creates a new user grade using Payload local API
 */
export const tryCreateUserGrade = Result.wrap(
	async (payload: Payload, request: Request, args: CreateUserGradeArgs) => {
		const {
			userId,
			gradebookItemId,
			grade,
			feedback,
			status = "not_graded",
			gradedBy,
			submittedAt,
		} = args;

		// Check if gradebook item exists
		const gradebookItem = await payload.findByID({
			collection: "gradebook-items",
			id: gradebookItemId,
			req: request,
		});

		if (!gradebookItem) {
			throw new GradebookItemNotFoundError(
				`Gradebook item with ID ${gradebookItemId} not found`,
			);
		}

		// Validate grade value if provided
		if (grade !== null && grade !== undefined) {
			if (grade < gradebookItem.minGrade || grade > gradebookItem.maxGrade) {
				throw new InvalidGradeValueError(
					`Grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
				);
			}
		}

		// Check if user exists
		const user = await payload.findByID({
			collection: "users",
			id: userId,
			req: request,
		});

		if (!user) {
			throw new Error(`User with ID ${userId} not found`);
		}

		// Check if grade already exists for this user and item
		const existingGrade = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						user: {
							equals: userId,
						},
					},
					{
						gradebookItem: {
							equals: gradebookItemId,
						},
					},
				],
			},
			limit: 1,
			req: request,
		});

		if (existingGrade.docs.length > 0) {
			throw new Error(
				`Grade already exists for user ${userId} and item ${gradebookItemId}`,
			);
		}

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const now = new Date().toISOString();
			const newGrade = await payload.create({
				collection: UserGrades.slug,
				data: {
					user: userId,
					gradebookItem: gradebookItemId,
					grade,
					feedback,
					status,
					gradedBy: gradedBy || (status === "graded" ? userId : undefined),
					gradedAt: status === "graded" ? now : undefined,
					submittedAt,
				},
				req: { ...request, transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const gradeUser = newGrade.user;
			assertZod(
				gradeUser,
				z.object({
					id: z.number(),
				}),
			);

			const gradeItem = newGrade.gradebookItem;
			assertZod(
				gradeItem,
				z.object({
					id: z.number(),
				}),
			);

			const gradeGradedBy = newGrade.gradedBy;
			assertZod(
				gradeGradedBy,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const result = {
				...newGrade,
				user: gradeUser,
				gradebookItem: gradeItem,
				gradedBy: gradeGradedBy,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) => {
		transformError(error) ??
			new UnknownError("Failed to create user grade", {
				cause: error,
			});
	},
);

/**
 * Updates an existing user grade using Payload local API
 */
export const tryUpdateUserGrade = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		gradeId: number,
		args: UpdateUserGradeArgs,
	) => {
		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			req: request,
		});

		if (!existingGrade) {
			throw new UserGradeNotFoundError(`Grade with ID ${gradeId} not found`);
		}

		// Get gradebook item to validate grade value
		const gradebookItem = await payload.findByID({
			collection: "gradebook-items",
			id:
				typeof existingGrade.gradebookItem === "number"
					? existingGrade.gradebookItem
					: existingGrade.gradebookItem.id,
			req: request,
		});

		if (!gradebookItem) {
			throw new GradebookItemNotFoundError(
				"Associated gradebook item not found",
			);
		}

		// Validate grade value if provided
		if (args.grade !== undefined && args.grade !== null) {
			if (
				args.grade < gradebookItem.minGrade ||
				args.grade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
				);
			}
		}

		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = { ...args };

		// Set gradedAt if status is being changed to 'graded'
		if (args.status === "graded" && existingGrade.status !== "graded") {
			updateData.gradedAt = now;
		}

		const updatedGrade = await payload.update({
			collection: UserGrades.slug,
			id: gradeId,
			data: updateData,
			req: request,
		});

		return updatedGrade as UserGrade;
	},
	(error) => {
		transformError(error) ??
			new UnknownError("Failed to update user grade", {
				cause: error,
			});
	},
);

/**
 * Finds a user grade by ID
 */
export const tryFindUserGradeById = Result.wrap(
	async (payload: Payload, gradeId: number) => {
		const grade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
		});

		if (!grade) {
			throw new UserGradeNotFoundError(`Grade with ID ${gradeId} not found`);
		}

		return grade as UserGrade;
	},
	(error) => {
		if (error instanceof UserGradeNotFoundError) {
			return error;
		}
		return new Error(
			`Failed to find user grade by ID: ${error instanceof Error ? error.message : String(error)}`,
		);
	},
);

/**
 * Finds a user grade by user and gradebook item
 */
export const tryFindUserGradeByUserAndItem = Result.wrap(
	async (payload: Payload, userId: number, gradebookItemId: number) => {
		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						user: {
							equals: userId,
						},
					},
					{
						gradebookItem: {
							equals: gradebookItemId,
						},
					},
				],
			},
			limit: 1,
		});

		if (grades.docs.length === 0) {
			throw new UserGradeNotFoundError(
				`Grade not found for user ${userId} and item ${gradebookItemId}`,
			);
		}

		return grades.docs[0] as UserGrade;
	},
	(error) => {
		transformError(error) ??
			new UnknownError("Failed to find user grade by user and item", {
				cause: error,
			});
	},
);

/**
 * Deletes a user grade by ID
 */
export const tryDeleteUserGrade = Result.wrap(
	async (payload: Payload, request: Request, gradeId: number) => {
		const deletedGrade = await payload.delete({
			collection: UserGrades.slug,
			id: gradeId,
			req: request,
		});

		return deletedGrade as UserGrade;
	},
	(error) =>
		new Error(
			`Failed to delete user grade: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Gets all grades for a specific user in a gradebook
 */
export const tryGetUserGradesForGradebook = Result.wrap(
	async (payload: Payload, userId: number, gradebookId: number) => {
		// First get all items in the gradebook
		const items = await payload.find({
			collection: "gradebook-items",
			where: {
				gradebook: {
					equals: gradebookId,
				},
			},
			limit: 999999,
		});

		const itemIds = items.docs.map((item) => item.id);

		// Then get all grades for this user and these items
		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						user: {
							equals: userId,
						},
					},
					{
						gradebookItem: {
							in: itemIds,
						},
					},
				],
			},
			depth: 1, // Get gradebook item details
			limit: 999999,
		});

		return grades.docs as UserGrade[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user grades for gradebook", {
			cause: error,
		}),
);

/**
 * Gets all grades for a specific gradebook item
 */
export const tryGetGradesForItem = Result.wrap(
	async (payload: Payload, gradebookItemId: number) => {
		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				gradebookItem: {
					equals: gradebookItemId,
				},
			},
			depth: 1, // Get user details
			limit: 999999,
		});

		return grades.docs as UserGrade[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get grades for item", {
			cause: error,
		}),
);

/**
 * Bulk updates grades for a user
 */
export const tryBulkUpdateUserGrades = Result.wrap(
	async (payload: Payload, request: Request, args: BulkGradeUpdateArgs) => {
		const { userId, grades, gradedBy } = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const now = new Date().toISOString();
			const results: UserGrade[] = [];

			for (const gradeData of grades) {
				// Check if grade already exists
				const existingGrade = await payload.find({
					collection: UserGrades.slug,
					where: {
						and: [
							{
								user: {
									equals: userId,
								},
							},
							{
								gradebookItem: {
									equals: gradeData.gradebookItemId,
								},
							},
						],
					},
					limit: 1,
					req: { ...request, transactionID },
				});

				if (existingGrade.docs.length > 0) {
					// Update existing grade
					const updatedGrade = await payload.update({
						collection: UserGrades.slug,
						id: existingGrade.docs[0].id,
						data: {
							...gradeData,
							gradedBy,
							gradedAt: gradeData.status === "graded" ? now : undefined,
						},
						req: { ...request, transactionID },
					});
					results.push(updatedGrade as UserGrade);
				} else {
					// Create new grade
					const newGrade = await payload.create({
						collection: UserGrades.slug,
						data: {
							user: userId,
							gradebookItem: gradeData.gradebookItemId,
							grade: gradeData.grade,
							feedback: gradeData.feedback,
							status: gradeData.status || "not_graded",
							gradedBy,
							gradedAt: gradeData.status === "graded" ? now : undefined,
							submittedAt: gradeData.submittedAt,
						},
						req: { ...request, transactionID },
					});
					results.push(newGrade as UserGrade);
				}
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return results;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to bulk update user grades", {
			cause: error,
		}),
);

/**
 * Calculates final grade for a user in a gradebook
 */
export const tryCalculateUserFinalGrade = Result.wrap(
	async (payload: Payload, userId: number, gradebookId: number) => {
		// Get all grades for the user in this gradebook
		const grades = await tryGetUserGradesForGradebook(
			payload,
			userId,
			gradebookId,
		);

		if (!grades.ok) {
			throw new Error(`Failed to get user grades: ${grades.error.message}`);
		}

		const userGrades = grades.value;

		// Calculate weighted average
		let totalWeight = 0;
		let weightedSum = 0;
		let hasGradedItems = false;

		for (const grade of userGrades) {
			const gradebookItem =
				typeof grade.gradebookItem === "number"
					? await payload.findByID({
							collection: "gradebook-items",
							id: grade.gradebookItem,
						})
					: grade.gradebookItem;

			if (
				!gradebookItem ||
				grade.status !== "graded" ||
				grade.grade === null ||
				grade.grade === undefined
			) {
				continue;
			}

			hasGradedItems = true;
			totalWeight += gradebookItem.weight;
			weightedSum += grade.grade * gradebookItem.weight;
		}

		if (!hasGradedItems || totalWeight === 0) {
			return { finalGrade: null, totalWeight: 0, gradedItems: 0 };
		}

		const finalGrade = weightedSum / totalWeight;

		return {
			finalGrade: Math.round(finalGrade * 100) / 100, // Round to 2 decimal places
			totalWeight,
			gradedItems: userGrades.filter(
				(g) => g.status === "graded" && g.grade !== null,
			).length,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate user final grade", {
			cause: error,
		}),
);
