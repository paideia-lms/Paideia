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
	enrollmentId: number;
	gradebookItemId: number;
	grade?: number | null;
	feedback?: string;
	gradedBy?: number;
	submittedAt?: string;
}

export interface UpdateUserGradeArgs {
	grade?: number | null;
	feedback?: string;
	gradedBy?: number;
	submittedAt?: string;
}

export interface SearchUserGradesArgs {
	enrollmentId?: number;
	gradebookItemId?: number;
	gradedBy?: number;
	limit?: number;
	page?: number;
}

export interface BulkGradeUpdateArgs {
	enrollmentId: number;
	grades: Array<{
		gradebookItemId: number;
		grade?: number | null;
		feedback?: string;
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
			enrollmentId,
			gradebookItemId,
			grade,
			feedback,
			gradedBy,
			submittedAt,
		} = args;

		// Check if enrollment exists
		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			req: request,
		});

		if (!enrollment) {
			throw new Error(`Enrollment with ID ${enrollmentId} not found`);
		}

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

		// Check if grade already exists for this enrollment and item
		const existingGrade = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						enrollment: {
							equals: enrollmentId,
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
				`Grade already exists for enrollment ${enrollmentId} and item ${gradebookItemId}`,
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
					enrollment: enrollmentId,
					gradebookItem: gradebookItemId,
					grade,
					feedback,
					gradedBy,
					gradedAt: grade !== null && grade !== undefined ? now : undefined,
					submittedAt,
				},
				req: { ...request, transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const gradeEnrollment = newGrade.enrollment;
			assertZod(
				gradeEnrollment,
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
				enrollment: gradeEnrollment,
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

		// Set gradedAt if grade is being set
		if (args.grade !== undefined && args.grade !== null) {
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
 * Finds a user grade by enrollment and gradebook item
 */
export const tryFindUserGradeByEnrollmentAndItem = Result.wrap(
	async (payload: Payload, enrollmentId: number, gradebookItemId: number) => {
		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						enrollment: {
							equals: enrollmentId,
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
				`Grade not found for enrollment ${enrollmentId} and item ${gradebookItemId}`,
			);
		}

		return grades.docs[0] as UserGrade;
	},
	(error) => {
		transformError(error) ??
			new UnknownError("Failed to find user grade by enrollment and item", {
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
 * Gets all grades for a specific enrollment in a gradebook
 */
export const tryGetUserGradesForGradebook = Result.wrap(
	async (payload: Payload, enrollmentId: number, gradebookId: number) => {
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

		// Then get all grades for this enrollment and these items
		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				and: [
					{
						enrollment: {
							equals: enrollmentId,
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
		const { enrollmentId, grades, gradedBy } = args;

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
								enrollment: {
									equals: enrollmentId,
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
							gradedAt:
								gradeData.grade !== null && gradeData.grade !== undefined
									? now
									: undefined,
						},
						req: { ...request, transactionID },
					});
					results.push(updatedGrade as UserGrade);
				} else {
					// Create new grade
					const newGrade = await payload.create({
						collection: UserGrades.slug,
						data: {
							enrollment: enrollmentId,
							gradebookItem: gradeData.gradebookItemId,
							grade: gradeData.grade,
							feedback: gradeData.feedback,
							gradedBy,
							gradedAt:
								gradeData.grade !== null && gradeData.grade !== undefined
									? now
									: undefined,
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
	async (payload: Payload, enrollmentId: number, gradebookId: number) => {
		// Get all grades for the enrollment in this gradebook
		const grades = await tryGetUserGradesForGradebook(
			payload,
			enrollmentId,
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

			if (!gradebookItem || grade.grade === null || grade.grade === undefined) {
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
				(g) => g.grade !== null && g.grade !== undefined,
			).length,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate user final grade", {
			cause: error,
		}),
);
