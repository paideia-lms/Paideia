import type { Payload, PayloadRequest } from "payload";
import { AssignmentSubmissions } from "server/collections/assignment-submissions";
import { GradebookCategories } from "server/collections/gradebook-categories";
import { UserGrades } from "server/collections/user-grades";
import { Users } from "server/collections/users";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	DuplicateUserGradeError,
	EnrollmentCourseMismatchError,
	EnrollmentNotFoundError,
	GradebookItemNotFoundError,
	GradebookNotFoundError,
	InvalidGradeValueError,
	NonExistingAssignmentSubmissionError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
	UserGradeNotFoundError,
	UserNotFoundError,
} from "~/utils/error";
import { tryGetAssignmentSubmissionById } from "./assignment-submission-management";
import { tryFindGradebookItemByCourseModuleLink } from "./gradebook-item-management";
import type { User, UserGrade } from "../payload-types";

export interface CreateUserGradeArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
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
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
	adjustmentId: string;
}

export interface ToggleAdjustmentArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
	async (args: CreateUserGradeArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
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
			user,
			req,
			overrideAccess,
		});

		if (!enrollment) {
			throw new EnrollmentNotFoundError(
				`Enrollment with ID ${enrollmentId} not found`,
			);
		}

		// Check if gradebook item exists
		const gradebookItem = await payload.findByID({
			collection: "gradebook-items",
			id: gradebookItemId,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
		});

		if (existingGrade.docs.length > 0) {
			throw new DuplicateUserGradeError(
				`Grade already exists for enrollment ${enrollmentId} and item ${gradebookItemId}`,
			);
		}

		// Use existing transaction if provided, otherwise create a new one
		const transactionWasProvided = !!req?.transactionID;
		const transactionID =
			req?.transactionID ?? (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		// Construct req with transactionID
		const reqWithTransaction: Partial<PayloadRequest> = req
			? { ...req, transactionID }
			: { transactionID };

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
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const gradeEnrollment = newGrade.enrollment;
			assertZodInternal(
				"tryCreateUserGrade: Grade enrollment is required",
				gradeEnrollment,
				z.object({
					id: z.number(),
				}),
			);

			const gradeItem = newGrade.gradebookItem;
			assertZodInternal(
				"tryCreateUserGrade: Grade item is required",
				gradeItem,
				z.object({
					id: z.number(),
				}),
			);

			const gradeGradedBy = newGrade.gradedBy;
			assertZodInternal(
				"tryCreateUserGrade: Grade graded by is required",
				gradeGradedBy,
				z.object({
					id: z.number(),
				}),
			);

			const result = {
				...newGrade,
				enrollment: gradeEnrollment,
				gradebookItem: gradeItem,
				gradedBy: gradeGradedBy,
			};
			return result;
		} catch (error) {
			// Rollback transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.rollbackTransaction(transactionID);
			}
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
	async (args: UpdateUserGradeArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			gradeId,
			baseGrade,
			feedback,
			gradedBy,
			submittedAt,
			isOverridden,
			overrideGrade,
			overrideReason,
			overriddenBy,
		} = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
		});

		if (!gradebookItem) {
			throw new GradebookItemNotFoundError(
				"Associated gradebook item not found",
			);
		}

		// Validate base grade value if provided
		if (baseGrade !== undefined && baseGrade !== null) {
			if (
				baseGrade < gradebookItem.minGrade ||
				baseGrade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Base grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
				);
			}
		}

		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = {};

		if (baseGrade !== undefined) {
			updateData.baseGrade = baseGrade;
		}
		if (feedback !== undefined) {
			updateData.feedback = feedback;
		}
		if (gradedBy !== undefined) {
			updateData.gradedBy = gradedBy;
		}
		if (submittedAt !== undefined) {
			updateData.submittedAt = submittedAt;
		}
		if (isOverridden !== undefined) {
			updateData.isOverridden = isOverridden;
		}
		if (overrideGrade !== undefined) {
			updateData.overrideGrade = overrideGrade;
		}
		if (overrideReason !== undefined) {
			updateData.overrideReason = overrideReason;
		}
		if (overriddenBy !== undefined) {
			updateData.overriddenBy = overriddenBy;
		}

		// Set gradedAt if base grade is being set
		if (baseGrade !== undefined && baseGrade !== null) {
			updateData.gradedAt = now;
			updateData.status = "graded";
		}

		const updatedGrade = await payload.update({
			collection: UserGrades.slug,
			id: gradeId,
			data: updateData,
			user,
			req,
			overrideAccess,
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

export interface FindUserGradeByIdArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
}

/**
 * Finds a user grade by ID
 */
export const tryFindUserGradeById = Result.wrap(
	async (args: FindUserGradeByIdArgs) => {
		const { payload, user = null, req, overrideAccess = false, gradeId } = args;

		const grade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
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

export interface FindUserGradeByEnrollmentAndItemArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	enrollmentId: number;
	gradebookItemId: number;
}

/**
 * Finds a user grade by enrollment and gradebook item
 */
export const tryFindUserGradeByEnrollmentAndItem = Result.wrap(
	async (args: FindUserGradeByEnrollmentAndItemArgs) => {
		const {
			payload,
			user,
			req,
			overrideAccess = false,
			enrollmentId,
			gradebookItemId,
		} = args;

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
			user,
			req,
			overrideAccess,
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

export interface FindUserGradesBySubmissionIdsArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	submissionIds: number[];
	submissionType: "assignment" | "quiz" | "discussion";
}

/**
 * Finds user grades by submission IDs
 * Note: Since we can't query polymorphic relationships directly with "in",
 * we query by submissionType and filter in memory
 */
export const tryFindUserGradesBySubmissionIds = Result.wrap(
	async (args: FindUserGradesBySubmissionIdsArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			submissionIds,
			submissionType,
		} = args;

		if (submissionIds.length === 0) {
			return new Map<
				number,
				{
					baseGrade: number | null;
					maxGrade: number | null;
					gradedAt: string | null;
					feedback: string | null;
				}
			>();
		}

		const submissionIdsSet = new Set(submissionIds);
		const gradesBySubmissionId = new Map<
			number,
			{
				baseGrade: number | null;
				maxGrade: number | null;
				gradedAt: string | null;
				feedback: string | null;
			}
		>();

		// Query user grades by submissionType since we can't query polymorphic relationships directly
		const userGradesResult = await payload.find({
			collection: UserGrades.slug,
			where: {
				submissionType: {
					equals: submissionType,
				},
			},
			limit: 1000,
			depth: 1,
			user,
			req,
			overrideAccess,
		});

		for (const grade of userGradesResult.docs) {
			const submission =
				grade.submission?.relationTo === `${submissionType}-submissions`
					? grade.submission.value
					: null;
			if (submission) {
				const submissionId =
					typeof submission === "number" ? submission : submission.id;
				// Only include grades for submissions we're interested in
				if (submissionIdsSet.has(submissionId)) {
					gradesBySubmissionId.set(submissionId, {
						baseGrade:
							grade.isOverridden && grade.overrideGrade !== null && grade.overrideGrade !== undefined
								? grade.overrideGrade
								: grade.baseGrade ?? null,
						maxGrade: grade.maxGrade ?? null,
						gradedAt: grade.gradedAt ?? null,
						feedback: grade.feedback ?? null,
					});
				}
			}
		}

		return gradesBySubmissionId;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find user grades by submission IDs", {
			cause: error,
		}),
);

export interface DeleteUserGradeArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
}

/**
 * Deletes a user grade by ID
 */
export const tryDeleteUserGrade = Result.wrap(
	async (args: DeleteUserGradeArgs) => {
		const { payload, user = null, req, overrideAccess = false, gradeId } = args;

		const deletedGrade = await payload.delete({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
		});

		return deletedGrade as UserGrade;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete user grade", {
			cause: error,
		}),
);

export interface GetUserGradesForGradebookArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	enrollmentId: number;
	gradebookId: number;
}

/**
 * Gets all grades for a specific enrollment in a gradebook
 */
export const tryGetUserGradesForGradebook = Result.wrap(
	async (args: GetUserGradesForGradebookArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			enrollmentId,
			gradebookId,
		} = args;

		// First get all items in the gradebook
		const items = await payload.find({
			collection: "gradebook-items",
			where: {
				gradebook: {
					equals: gradebookId,
				},
			},
			limit: 999999,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
		});

		return grades.docs as UserGrade[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user grades for gradebook", {
			cause: error,
		}),
);

export interface GetGradesForItemArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradebookItemId: number;
}

/**
 * Gets all grades for a specific gradebook item
 */
export const tryGetGradesForItem = Result.wrap(
	async (args: GetGradesForItemArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			gradebookItemId,
		} = args;

		const grades = await payload.find({
			collection: UserGrades.slug,
			where: {
				gradebookItem: {
					equals: gradebookItemId,
				},
			},
			depth: 1, // Get user details
			limit: 999999,
			user,
			req,
			overrideAccess,
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
	async (args: BulkGradeUpdateArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			enrollmentId,
			grades,
			gradedBy,
		} = args;

		// Use existing transaction if provided, otherwise create a new one
		const transactionWasProvided = !!req?.transactionID;
		const transactionID =
			req?.transactionID ?? (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		// Construct req with transactionID
		const reqWithTransaction: Partial<PayloadRequest> = req
			? { ...req, transactionID }
			: { transactionID };

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
					user,
					req: reqWithTransaction,
					overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
					results.push(newGrade as UserGrade);
				}
			}

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return results;
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
		new UnknownError("Failed to bulk update user grades", {
			cause: error,
		}),
);

export interface CalculateUserFinalGradeArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	enrollmentId: number;
	gradebookId: number;
}

/**
 * Calculates final grade for a user in a gradebook
 */
export const tryCalculateUserFinalGrade = Result.wrap(
	async (args: CalculateUserFinalGradeArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			enrollmentId,
			gradebookId,
		} = args;

		// Get all grades for the enrollment in this gradebook
		const grades = await tryGetUserGradesForGradebook({
			payload,
			user,
			req,
			overrideAccess,
			enrollmentId,
			gradebookId,
		});

		if (!grades.ok) {
			throw new UnknownError("Failed to get user grades", {
				cause: grades.error,
			});
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
	async (args: AddAdjustmentArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			gradeId,
			type,
			points,
			reason,
			appliedBy,
		} = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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
	async (args: RemoveAdjustmentArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			gradeId,
			adjustmentId,
		} = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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
	async (args: ToggleAdjustmentArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			gradeId,
			adjustmentId,
		} = args;

		// Check if grade exists
		const existingGrade = await payload.findByID({
			collection: UserGrades.slug,
			id: gradeId,
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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
		throw new UserNotFoundError(`User not found for enrollment ${enrollmentId}`);
	}

	const grades = gradesByEnrollment.get(enrollmentId) || [];

	// Calculate final grade for this enrollment
	const finalGradeResult = await tryCalculateUserFinalGrade({
		payload,
		user: null,
		req: undefined,
		overrideAccess: false,
		enrollmentId,
		gradebookId,
	});

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

export interface GetUserGradesJsonRepresentationArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseId: number;
}

/**
 * Constructs a JSON representation of user grades for a course
 */
export const tryGetUserGradesJsonRepresentation = Result.wrap(
	async (args: GetUserGradesJsonRepresentationArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			courseId,
		} = args;

		// Get the gradebook for the course
		const gradebook = await payload.find({
			collection: "gradebooks",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
			user,
			req,
			overrideAccess,
		});

		if (gradebook.docs.length === 0) {
			throw new GradebookNotFoundError(
				`No gradebook found for course ${courseId}`,
			);
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
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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
			} catch { }
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

export interface GetSingleUserGradesJsonRepresentationArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseId: number;
	enrollmentId: number;
}

/**
 * Constructs a JSON representation of a single user's grades in a course
 */
export const tryGetSingleUserGradesJsonRepresentation = Result.wrap(
	async (args: GetSingleUserGradesJsonRepresentationArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			courseId,
			enrollmentId,
		} = args;

		// Get the gradebook for the course
		const gradebook = await payload.find({
			collection: "gradebooks",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit: 1,
			user,
			req,
			overrideAccess,
		});

		if (gradebook.docs.length === 0) {
			throw new GradebookNotFoundError(
				`No gradebook found for course ${courseId}`,
			);
		}

		const gradebookId = gradebook.docs[0].id;

		// Get the specific enrollment
		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			depth: 1, // Get user details
			user,
			req,
			overrideAccess,
		});

		if (!enrollment) {
			throw new EnrollmentNotFoundError(
				`Enrollment with ID ${enrollmentId} not found`,
			);
		}

		// Verify the enrollment belongs to the course
		const enrollmentCourseId =
			typeof enrollment.course === "number"
				? enrollment.course
				: enrollment.course.id;

		if (enrollmentCourseId !== courseId) {
			throw new EnrollmentCourseMismatchError(
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
			user,
			req,
			overrideAccess,
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
			user,
			req,
			overrideAccess,
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

export interface GradeAssignmentSubmissionArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	submissionId: number;
	score: number;
	feedback?: string;
	gradedBy: number;
	status?: "graded" | "returned";
}

/**
 * Grades an assignment submission by creating or updating a user grade
 * This function finds the gradebook item automatically from the submission's courseModuleLink
 */
export const tryGradeAssignmentSubmission = Result.wrap(
	async (args: GradeAssignmentSubmissionArgs) => {
		const {
			payload,
			user,
			req,
			overrideAccess = false,
			submissionId,
			score,
			feedback,
			gradedBy,
			status = "graded",
		} = args;

		// Validate score
		if (score < 0) {
			throw new InvalidGradeValueError("Score cannot be negative");
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get the submission with depth to access enrollment and courseModuleLink
			const submissionResult = await tryGetAssignmentSubmissionById(payload, {
				id: submissionId,
			});

			if (!submissionResult.ok) {
				throw new NonExistingAssignmentSubmissionError(
					`Failed to get submission: ${submissionResult.error.message}`,
				);
			}

			const submission = submissionResult.value;

			// Extract enrollment ID
			const enrollmentId =
				typeof submission.enrollment === "number"
					? submission.enrollment
					: submission.enrollment.id;

			// Extract courseModuleLink ID
			const courseModuleLinkId =
				typeof submission.courseModuleLink === "number"
					? submission.courseModuleLink
					: submission.courseModuleLink.id;

			const requestWithTransaction = {
				...(req || {}),
				transactionID,
			} as PayloadRequest;

			// Find gradebook item by course module link
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user,
				req: requestWithTransaction,
				overrideAccess,
				courseModuleLinkId,
			});

			if (!gradebookItemResult.ok) {
				throw new GradebookItemNotFoundError(
					`Failed to find gradebook item: ${gradebookItemResult.error.message}`,
				);
			}

			const gradebookItem = gradebookItemResult.value;

			// Validate score against gradebook item limits
			if (score < gradebookItem.minGrade || score > gradebookItem.maxGrade) {
				throw new InvalidGradeValueError(
					`Score must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
				);
			}

			// Check if user grade already exists
			const existingGradeResult = await tryFindUserGradeByEnrollmentAndItem({
				payload,
				user,
				req: requestWithTransaction,
				overrideAccess,
				enrollmentId,
				gradebookItemId: gradebookItem.id,
			});

			let userGrade: UserGrade;

			if (existingGradeResult.ok) {
				// Update existing grade
				const updateResult = await tryUpdateUserGrade({
					payload,
					user,
					req: requestWithTransaction,
					overrideAccess,
					gradeId: existingGradeResult.value.id,
					baseGrade: score,
					feedback,
					gradedBy,
					submittedAt: submission.submittedAt || undefined,
				});

				if (!updateResult.ok) {
					throw new UnknownError("Failed to update user grade", {
						cause: updateResult.error,
					});
				}

				userGrade = updateResult.value;
			} else {
				// Create new grade
				const createResult = await tryCreateUserGrade({
					payload,
					user,
					req: requestWithTransaction,
					overrideAccess,
					enrollmentId,
					gradebookItemId: gradebookItem.id,
					baseGrade: score,
					baseGradeSource: "submission",
					submission: submissionId,
					submissionType: "assignment",
					feedback,
					gradedBy,
					submittedAt: submission.submittedAt || undefined,
				});

				if (!createResult.ok) {
					throw new UnknownError("Failed to create user grade", {
						cause: createResult.error,
					});
				}

				userGrade = createResult.value;
			}

			// Update submission status
			const updatedSubmission = await payload.update({
				collection: AssignmentSubmissions.slug,
				id: submissionId,
				data: {
					status,
				},
				user,
				req: requestWithTransaction,
				overrideAccess,
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				submission: updatedSubmission,
				userGrade,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to grade assignment submission", {
			cause: error,
		}),
);
