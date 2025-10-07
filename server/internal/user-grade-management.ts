import type { Payload } from "payload";
import { GradebookCategories } from "server/collections/gradebook-categories";
import { UserGrades } from "server/collections/user-grades";
import { Users } from "server/collections/users";
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
	baseGrade?: number | null;
	baseGradeSource?: "submission" | "manual";
	submission?: number;
	submissionType?: "assignment" | "quiz" | "discussion" | "manual";
	feedback?: string;
	gradedBy?: number;
	submittedAt?: string;
}

export interface UpdateUserGradeArgs {
	baseGrade?: number | null;
	feedback?: string;
	gradedBy?: number;
	submittedAt?: string;
	// Override fields
	isOverridden?: boolean;
	overrideGrade?: number;
	overrideReason?: string;
	overriddenBy?: number;
}

export interface AddAdjustmentArgs {
	gradeId: number;
	type:
		| "bonus"
		| "penalty"
		| "late_deduction"
		| "participation"
		| "curve"
		| "other";
	points: number;
	reason: string;
	appliedBy: number;
}

export interface RemoveAdjustmentArgs {
	gradeId: number;
	adjustmentId: string;
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
		baseGrade?: number | null;
		feedback?: string;
		submittedAt?: string;
	}>;
	gradedBy: number;
}

export interface UserGradeItem {
	item_id: number;
	item_name: string;
	item_type:
		| "manual_item"
		| "page"
		| "whiteboard"
		| "assignment"
		| "quiz"
		| "discussion";
	category_id?: number | null;
	category_name?: string | null;
	weight: number;
	max_grade: number;
	min_grade: number;
	base_grade?: number | null;
	override_grade?: number | null;
	is_overridden: boolean;
	feedback?: string | null;
	graded_at?: string | null;
	submitted_at?: string | null;
	status: "draft" | "graded" | "returned";
	adjustments: Array<{
		points: number;
		reason: string;
		is_active: boolean;
	}>;
}

export interface UserGradeEnrollment {
	enrollment_id: number;
	user_id: number;
	user_name: string;
	user_email: string;
	final_grade?: number | null;
	total_weight: number;
	graded_items: number;
	items: UserGradeItem[];
}

export interface UserGradesJsonRepresentation {
	course_id: number;
	gradebook_id: number;
	enrollments: UserGradeEnrollment[];
}

export interface SingleUserGradesJsonRepresentation {
	course_id: number;
	gradebook_id: number;
	enrollment: UserGradeEnrollment;
}

/**
 * Creates a new user grade using Payload local API
 */
export const tryCreateUserGrade = Result.wrap(
	async (payload: Payload, request: Request, args: CreateUserGradeArgs) => {
		const {
			enrollmentId,
			gradebookItemId,
			baseGrade,
			baseGradeSource = "manual",
			submission,
			submissionType = "manual",
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

		// Validate base grade value if provided
		if (baseGrade !== null && baseGrade !== undefined) {
			if (
				baseGrade < gradebookItem.minGrade ||
				baseGrade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Base grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
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
					baseGrade,
					baseGradeSource,
					submission: submission
						? {
								relationTo:
									submissionType === "assignment"
										? "assignment-submissions"
										: submissionType === "quiz"
											? "quiz-submissions"
											: "discussion-submissions",
								value: submission,
							}
						: undefined,
					submissionType,
					feedback,
					gradedBy,
					gradedAt:
						baseGrade !== null && baseGrade !== undefined ? now : undefined,
					submittedAt,
					status:
						baseGrade !== null && baseGrade !== undefined ? "graded" : "draft",
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

		// Validate base grade value if provided
		if (args.baseGrade !== undefined && args.baseGrade !== null) {
			if (
				args.baseGrade < gradebookItem.minGrade ||
				args.baseGrade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Base grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
				);
			}
		}

		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = { ...args };

		// Set gradedAt if base grade is being set
		if (args.baseGrade !== undefined && args.baseGrade !== null) {
			updateData.gradedAt = now;
			updateData.status = "graded";
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
							baseGrade: gradeData.baseGrade,
							feedback: gradeData.feedback,
							gradedBy,
							gradedAt:
								gradeData.baseGrade !== null &&
								gradeData.baseGrade !== undefined
									? now
									: undefined,
							status:
								gradeData.baseGrade !== null &&
								gradeData.baseGrade !== undefined
									? "graded"
									: "draft",
							submittedAt: gradeData.submittedAt,
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
							baseGrade: gradeData.baseGrade,
							baseGradeSource: "manual",
							submissionType: "manual",
							feedback: gradeData.feedback,
							gradedBy,
							gradedAt:
								gradeData.baseGrade !== null &&
								gradeData.baseGrade !== undefined
									? now
									: undefined,
							status:
								gradeData.baseGrade !== null &&
								gradeData.baseGrade !== undefined
									? "graded"
									: "draft",
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

			if (!gradebookItem) {
				continue;
			}

			// Calculate final grade: use override if set, otherwise use base grade + adjustments
			let finalGrade = grade.baseGrade || 0;

			// Add adjustments if any
			if (grade.adjustments && grade.adjustments.length > 0) {
				const activeAdjustments = grade.adjustments
					.filter((adj) => adj.isActive)
					.reduce((sum, adj) => sum + (adj.points || 0), 0);
				finalGrade += activeAdjustments;
			}

			// Use override if set
			if (
				grade.isOverridden &&
				grade.overrideGrade !== null &&
				grade.overrideGrade !== undefined
			) {
				finalGrade = grade.overrideGrade;
			}

			if (finalGrade === null || finalGrade === undefined) {
				continue;
			}

			// Calculate effective weight: item weight * category weight (if item is in category)
			let effectiveWeight = gradebookItem.weight;

			if (gradebookItem.category) {
				const categoryId =
					typeof gradebookItem.category === "number"
						? gradebookItem.category
						: gradebookItem.category.id;

				const category = await payload.findByID({
					collection: "gradebook-categories",
					id: categoryId,
				});

				if (category?.weight) {
					// Item weight is a percentage of the category weight
					effectiveWeight = (gradebookItem.weight / 100) * category.weight;
				}
			}

			hasGradedItems = true;
			totalWeight += effectiveWeight;
			weightedSum += finalGrade * effectiveWeight;
		}

		if (!hasGradedItems || totalWeight === 0) {
			return { finalGrade: null, totalWeight: 0, gradedItems: 0 };
		}

		const finalGrade = weightedSum / totalWeight;

		return {
			finalGrade: Math.round(finalGrade * 100) / 100, // Round to 2 decimal places
			totalWeight,
			gradedItems: userGrades.filter(
				(g) => g.baseGrade !== null && g.baseGrade !== undefined,
			).length,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate user final grade", {
			cause: error,
		}),
);

/**
 * Adds an adjustment to a user grade
 */
export const tryAddAdjustment = Result.wrap(
	async (payload: Payload, request: Request, args: AddAdjustmentArgs) => {
		const { gradeId, type, points, reason, appliedBy } = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			req: request,
		});

		if (!existingGrade) {
			throw new UserGradeNotFoundError(`Grade with ID ${gradeId} not found`);
		}

		// Create new adjustment
		const newAdjustment = {
			type,
			points,
			reason,
			appliedBy,
			appliedAt: new Date().toISOString(),
			isActive: true,
			id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};

		// Add adjustment to existing adjustments
		const currentAdjustments = existingGrade.adjustments || [];
		const updatedAdjustments = [...currentAdjustments, newAdjustment];

		const updatedGrade = await payload.update({
			collection: UserGrades.slug,
			id: gradeId,
			data: {
				adjustments: updatedAdjustments,
			},
			req: request,
		});

		return updatedGrade as UserGrade;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to add adjustment", {
			cause: error,
		}),
);

/**
 * Removes an adjustment from a user grade
 */
export const tryRemoveAdjustment = Result.wrap(
	async (payload: Payload, request: Request, args: RemoveAdjustmentArgs) => {
		const { gradeId, adjustmentId } = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			req: request,
		});

		if (!existingGrade) {
			throw new UserGradeNotFoundError(`Grade with ID ${gradeId} not found`);
		}

		// Remove adjustment
		const currentAdjustments = existingGrade.adjustments || [];
		const updatedAdjustments = currentAdjustments.filter(
			(adj) => adj.id !== adjustmentId,
		);

		const updatedGrade = await payload.update({
			collection: UserGrades.slug,
			id: gradeId,
			data: {
				adjustments: updatedAdjustments,
			},
			req: request,
		});

		return updatedGrade as UserGrade;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to remove adjustment", {
			cause: error,
		}),
);

/**
 * Toggles an adjustment's active status
 */
export const tryToggleAdjustment = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		gradeId: number,
		adjustmentId: string,
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

		// Toggle adjustment active status
		const currentAdjustments = existingGrade.adjustments || [];
		const updatedAdjustments = currentAdjustments.map((adj) => {
			if (adj.id === adjustmentId) {
				return { ...adj, isActive: !adj.isActive };
			}
			return adj;
		});

		const updatedGrade = await payload.update({
			collection: UserGrades.slug,
			id: gradeId,
			data: {
				adjustments: updatedAdjustments,
			},
			req: request,
		});

		return updatedGrade as UserGrade;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to toggle adjustment", {
			cause: error,
		}),
);

/**
 * Builds a single user's grade representation
 */
const buildUserGradeRepresentation = async (
	payload: Payload,
	enrollment: {
		id: number;
		user:
			| number
			| {
					id: number;
					firstName?: string | null;
					lastName?: string | null;
					email: string;
			  };
	},
	gradebookId: number,
	gradebookItems: Array<{
		id: number;
		name: string;
		weight: number;
		maxGrade: number;
		minGrade: number;
		category?:
			| number
			| { id: number; name: string; weight?: number | null }
			| null;
		activityModuleType?: string | string[] | null;
	}>,
	gradesByEnrollment: Map<number, UserGrade[]>,
): Promise<UserGradeEnrollment> => {
	const enrollmentId = enrollment.id;
	const user =
		typeof enrollment.user === "number"
			? await payload.findByID({ collection: Users.slug, id: enrollment.user })
			: enrollment.user;

	if (!user) {
		throw new Error(`User not found for enrollment ${enrollmentId}`);
	}

	const grades = gradesByEnrollment.get(enrollmentId) || [];

	// Calculate final grade for this enrollment
	const finalGradeResult = await tryCalculateUserFinalGrade(
		payload,
		enrollmentId,
		gradebookId,
	);

	const finalGrade = finalGradeResult.ok ? finalGradeResult.value : null;

	// Build items for this enrollment
	const items: UserGradeItem[] = [];

	for (const item of gradebookItems) {
		const grade = grades.find((g) => {
			const gradeItemId =
				typeof g.gradebookItem === "number"
					? g.gradebookItem
					: g.gradebookItem.id;
			return gradeItemId === item.id;
		});

		const category =
			typeof item.category === "number"
				? await payload.findByID({
						collection: GradebookCategories.slug,
						id: item.category,
					})
				: item.category;

		// Calculate effective weight
		let effectiveWeight = item.weight;
		if (category?.weight) {
			effectiveWeight = (item.weight / 100) * category.weight;
		}

		const itemType = Array.isArray(item.activityModuleType)
			? item.activityModuleType[0]
			: item.activityModuleType;
		const validItemType =
			itemType &&
			[
				"manual_item",
				"page",
				"whiteboard",
				"assignment",
				"quiz",
				"discussion",
			].includes(itemType)
				? (itemType as
						| "manual_item"
						| "page"
						| "whiteboard"
						| "assignment"
						| "quiz"
						| "discussion")
				: "manual_item";

		items.push({
			item_id: item.id,
			item_name: item.name,
			item_type: validItemType,
			category_id: category?.id ?? null,
			category_name: category?.name ?? null,
			weight: effectiveWeight,
			max_grade: item.maxGrade,
			min_grade: item.minGrade,
			base_grade: grade?.baseGrade ?? null,
			override_grade: grade?.overrideGrade ?? null,
			is_overridden: grade?.isOverridden ?? false,
			feedback: grade?.feedback ?? null,
			graded_at: grade?.gradedAt ?? null,
			submitted_at: grade?.submittedAt ?? null,
			status: grade?.status ?? "draft",
			adjustments:
				grade?.adjustments?.map((adj) => ({
					points: adj.points ?? 0,
					reason: adj.reason ?? "",
					is_active: adj.isActive ?? false,
				})) ?? [],
		});
	}

	return {
		enrollment_id: enrollmentId,
		user_id: user.id,
		user_name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
		user_email: user.email,
		final_grade: finalGrade?.finalGrade ?? null,
		total_weight: finalGrade?.totalWeight ?? 0,
		graded_items: finalGrade?.gradedItems ?? 0,
		items,
	};
};

/**
 * Constructs a JSON representation of user grades for a course
 */
export const tryGetUserGradesJsonRepresentation = Result.wrap(
	async (payload: Payload, courseId: number) => {
		// Get the gradebook for the course
		const gradebook = await payload.find({
			collection: "gradebooks",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
		});

		if (gradebook.docs.length === 0) {
			throw new Error(`No gradebook found for course ${courseId}`);
		}

		const gradebookId = gradebook.docs[0].id;

		// Get all enrollments for the course
		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				course: {
					equals: courseId,
				},
			},
			depth: 1, // Get user details
			limit: 999999,
		});

		// Get all gradebook items for the gradebook
		const gradebookItems = await payload.find({
			collection: "gradebook-items",
			where: {
				gradebook: {
					equals: gradebookId,
				},
			},
			depth: 1, // Get category details
			limit: 999999,
			sort: "sortOrder",
		});

		// Get all user grades for this gradebook
		const userGrades = await payload.find({
			collection: UserGrades.slug,
			where: {
				gradebookItem: {
					in: gradebookItems.docs.map((item) => item.id),
				},
			},
			depth: 2, // Get enrollment and gradebook item details
			limit: 999999,
		});

		// Group grades by enrollment
		const gradesByEnrollment = new Map<number, UserGrade[]>();
		for (const grade of userGrades.docs as UserGrade[]) {
			const enrollmentId =
				typeof grade.enrollment === "number"
					? grade.enrollment
					: grade.enrollment.id;

			if (!gradesByEnrollment.has(enrollmentId)) {
				gradesByEnrollment.set(enrollmentId, []);
			}
			const grades = gradesByEnrollment.get(enrollmentId);
			if (grades) {
				grades.push(grade);
			}
		}

		// Build the representation
		const enrollmentRepresentations: UserGradeEnrollment[] = [];

		for (const enrollment of enrollments.docs) {
			try {
				const enrollmentRep = await buildUserGradeRepresentation(
					payload,
					enrollment,
					gradebookId,
					gradebookItems.docs,
					gradesByEnrollment,
				);
				enrollmentRepresentations.push(enrollmentRep);
			} catch {}
		}

		const result: UserGradesJsonRepresentation = {
			course_id: courseId,
			gradebook_id: gradebookId,
			enrollments: enrollmentRepresentations,
		};

		return result;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user grades JSON representation", {
			cause: error,
		}),
);

/**
 * Constructs a JSON representation of a single user's grades in a course
 */
export const tryGetSingleUserGradesJsonRepresentation = Result.wrap(
	async (payload: Payload, courseId: number, enrollmentId: number) => {
		// Get the gradebook for the course
		const gradebook = await payload.find({
			collection: "gradebooks",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
		});

		if (gradebook.docs.length === 0) {
			throw new Error(`No gradebook found for course ${courseId}`);
		}

		const gradebookId = gradebook.docs[0].id;

		// Get the specific enrollment
		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			depth: 1, // Get user details
		});

		if (!enrollment) {
			throw new Error(`Enrollment with ID ${enrollmentId} not found`);
		}

		// Verify the enrollment belongs to the course
		const enrollmentCourseId =
			typeof enrollment.course === "number"
				? enrollment.course
				: enrollment.course.id;

		if (enrollmentCourseId !== courseId) {
			throw new Error(
				`Enrollment ${enrollmentId} does not belong to course ${courseId}`,
			);
		}

		// Get all gradebook items for the gradebook
		const gradebookItems = await payload.find({
			collection: "gradebook-items",
			where: {
				gradebook: {
					equals: gradebookId,
				},
			},
			depth: 1, // Get category details
			limit: 999999,
			sort: "sortOrder",
		});

		// Get all user grades for this enrollment
		const userGrades = await payload.find({
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
							in: gradebookItems.docs.map((item) => item.id),
						},
					},
				],
			},
			depth: 2, // Get gradebook item details
			limit: 999999,
		});

		// Group grades by enrollment (single enrollment in this case)
		const gradesByEnrollment = new Map<number, UserGrade[]>();
		for (const grade of userGrades.docs as UserGrade[]) {
			const gradeEnrollmentId =
				typeof grade.enrollment === "number"
					? grade.enrollment
					: grade.enrollment.id;

			if (!gradesByEnrollment.has(gradeEnrollmentId)) {
				gradesByEnrollment.set(gradeEnrollmentId, []);
			}
			const grades = gradesByEnrollment.get(gradeEnrollmentId);
			if (grades) {
				grades.push(grade);
			}
		}

		// Build the single user representation
		const enrollmentRep = await buildUserGradeRepresentation(
			payload,
			enrollment,
			gradebookId,
			gradebookItems.docs,
			gradesByEnrollment,
		);

		const result: SingleUserGradesJsonRepresentation = {
			course_id: courseId,
			gradebook_id: gradebookId,
			enrollment: enrollmentRep,
		};

		return result;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get single user grades JSON representation", {
			cause: error,
		}),
);
