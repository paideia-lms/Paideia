import type { Payload, PayloadRequest, TypedUser } from "payload";
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
	NotImplementedError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
	UserGradeNotFoundError,
	UserNotFoundError,
} from "~/utils/error";
import type { User, UserGrade } from "../payload-types";
import { tryListDiscussionSubmissions } from "./discussion-management";
import { tryFindGradebookItemByCourseModuleLink } from "./gradebook-item-management";
import { tryGetGradebookAllRepresentations } from "./gradebook-management";
import { prettifyMarkdown } from "./utils/markdown-prettify";

export interface CreateUserGradeArgs {
	payload: Payload;
	user?: TypedUser | null;
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
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
	baseGrade?: number | null;
	feedback?: string;
	gradedBy?: number;
	submittedAt?: string;
	submission?: number;
	submissionType?: "assignment" | "quiz" | "discussion" | "manual";
	// Override fields
	isOverridden?: boolean;
	overrideGrade?: number;
	overrideReason?: string;
	overriddenBy?: number;
}

export interface AddAdjustmentArgs {
	payload: Payload;
	user?: TypedUser | null;
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
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	gradeId: number;
	adjustmentId: string;
}

export interface ToggleAdjustmentArgs {
	payload: Payload;
	user?: TypedUser | null;
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
	user?: TypedUser | null;
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
			submission,
			submissionType,
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
		if (submission !== undefined && submissionType !== undefined) {
			updateData.submission = {
				relationTo:
					submissionType === "assignment"
						? "assignment-submissions"
						: submissionType === "quiz"
							? "quiz-submissions"
							: "discussion-submissions",
				value: submission,
			};
			updateData.submissionType = submissionType;
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
	user?: TypedUser | null;
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
	user?: TypedUser | null;
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
	user?: TypedUser | null;
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
							grade.isOverridden &&
								grade.overrideGrade !== null &&
								grade.overrideGrade !== undefined
								? grade.overrideGrade
								: (grade.baseGrade ?? null),
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
	user?: TypedUser | null;
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
	user?: TypedUser | null;
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
		const items = await payload
			.find({
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
			})
			.catch((e) => {
				throw new GradebookItemNotFoundError("Failed to get gradebook items", {
					cause: e,
				});
			});

		const itemIds = items.docs.map((item) => item.id);

		// Then get all grades for this enrollment and these items
		const grades = await payload
			.find({
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
			})
			.catch((e) => {
				throw new UserGradeNotFoundError("Failed to get user grades", {
					cause: e,
				});
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
	user?: TypedUser | null;
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
	user?: TypedUser | null;
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
					effectiveWeight =
						((gradebookItem.weight ?? 0) / 100) * category.weight;
				}
			}

			hasGradedItems = true;
			totalWeight += effectiveWeight ?? 0;
			weightedSum += finalGrade * (effectiveWeight ?? 0);
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
const tryBuildUserGradeRepresentation = Result.wrap(
	async (args: {
		payload: Payload;
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
		};
		gradebookId: number;
		gradebookItems: Array<{
			id: number;
			name: string;
			weight: number | null;
			maxGrade: number;
			minGrade: number;
			category?:
			| number
			| { id: number; name: string; weight?: number | null }
			| null;
			activityModuleType?: string | string[] | null;
		}>;
		gradesByEnrollment: Map<number, UserGrade[]>;
		user?: TypedUser | null;
		req?: Partial<PayloadRequest>;
		overrideAccess?: boolean;
	}): Promise<UserGradeEnrollment> => {
		const {
			payload,
			enrollment,
			gradebookId,
			gradebookItems,
			gradesByEnrollment,
			user: contextUser = null,
			req,
			overrideAccess = false,
		} = args;

		const enrollmentId = enrollment.id;
		const user =
			typeof enrollment.user === "number"
				? await payload.findByID({
					collection: Users.slug,
					id: enrollment.user,
					user: contextUser,
					req,
					overrideAccess,
				})
				: enrollment.user;

		if (!user) {
			throw new UserNotFoundError(
				`User not found for enrollment ${enrollmentId}`,
			);
		}

		const grades = gradesByEnrollment.get(enrollmentId) || [];

		// Calculate final grade for this enrollment
		const finalGradeResult = await tryCalculateUserFinalGrade({
			payload,
			user: contextUser,
			req,
			overrideAccess,
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
						user: contextUser,
						req,
						overrideAccess,
					})
					: item.category;

			// Calculate effective weight, effective weight cannot be null
			let effectiveWeight = item.weight ?? 0;
			if (category?.weight) {
				effectiveWeight = ((item.weight ?? 0) / 100) * category.weight;
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

		// Count graded items based on items that have a base_grade
		const gradedItemsCount = items.filter(
			(item) => item.base_grade !== null && item.base_grade !== undefined,
		).length;

		return {
			enrollment_id: enrollmentId,
			user_id: user.id,
			user_name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
			user_email: user.email,
			final_grade: finalGrade?.finalGrade ?? null,
			total_weight: finalGrade?.totalWeight ?? 0,
			graded_items: gradedItemsCount,
			items,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to build user grade representation", {
			cause: error,
		}),
);

export interface GetUserGradesJsonRepresentationArgs {
	payload: Payload;
	user?: TypedUser | null;
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
		const gradebookItems = await payload
			.find({
				collection: "gradebook-items",
				where: {
					gradebook: {
						equals: gradebookId,
					},
				},
				depth: 1, // Get category details
				limit: 999999,
				sort: "sortOrder",
				pagination: false,
				user,
				req,
				overrideAccess,
			})
			.then(({ docs }) => {
				// type narrowing
				return docs.map((item) => {
					const category = item.category;
					assertZodInternal(
						"tryGetUserGradesJsonRepresentation: Category is required",
						category,
						z
							.object({
								id: z.number(),
							})
							.nullable(),
					);

					assertZodInternal(
						"tryGetUserGradesJsonRepresentation: Weight is required",
						item.weight,
						z.number().nullable(),
					);

					return {
						...item,
						category: category,
						weight: item.weight,
					};
				});
			});
		// Get all user grades for this gradebook
		const userGrades = await payload.find({
			collection: UserGrades.slug,
			where: {
				gradebookItem: {
					in: gradebookItems.map((item) => item.id),
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
			const enrollmentRepResult = await tryBuildUserGradeRepresentation({
				payload,
				enrollment,
				gradebookId,
				gradebookItems: gradebookItems,
				gradesByEnrollment,
				user,
				req,
				overrideAccess,
			});

			if (enrollmentRepResult.ok) {
				enrollmentRepresentations.push(enrollmentRepResult.value);
			}
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
	user?: TypedUser | null;
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
		const gradebookItems = await payload
			.find({
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
			})
			.then(({ docs }) => {
				return docs.map((item) => {
					const category = item.category;
					assertZodInternal(
						"tryGetSingleUserGradesJsonRepresentation: Category is object",
						category,
						z.object({
							id: z.number(),
						}).nullable(),
					);
					assertZodInternal(
						"tryGetSingleUserGradesJsonRepresentation: Weight is required",
						item.weight,
						z.number().nullable(),
					);
					return {
						...item,
						category: category,
						weight: item.weight,
					};
				});
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
							in: gradebookItems.map((item) => item.id),
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
		const enrollmentRepResult = await tryBuildUserGradeRepresentation({
			payload,
			enrollment,
			gradebookId,
			gradebookItems: gradebookItems,
			gradesByEnrollment,
			user,
			req,
			overrideAccess,
		});

		if (!enrollmentRepResult.ok) {
			throw enrollmentRepResult.error;
		}

		const enrollmentRep = enrollmentRepResult.value;

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

export interface GetAdjustedSingleUserGradesJsonRepresentationArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseId: number;
	enrollmentId: number;
}

/**
 * Helper type for recursive item search
 */
type SearchableItem = {
	id: number;
	type: string;
	overall_weight?: number | null;
	grade_items?: SearchableItem[];
};

/**
 * Helper function to recursively find an item by ID in GradebookSetupItemWithCalculations tree
 */
function findItemById(
	items: SearchableItem[],
	itemId: number,
): { overall_weight: number | null } | null {
	for (const item of items) {
		if (item.id === itemId && item.type !== "category") {
			return { overall_weight: item.overall_weight ?? null };
		}
		if (item.grade_items) {
			const found = findItemById(item.grade_items, itemId);
			if (found) {
				return found;
			}
		}
	}
	return null;
}

/**
 * Constructs an adjusted JSON representation of a single user's grades in a course
 * This version uses GradebookSetupForUI to get accurate weights (overall_weight)
 * instead of the raw weights from the database
 */
export const tryGetAdjustedSingleUserGradesJsonRepresentation = Result.wrap(
	async (args: GetAdjustedSingleUserGradesJsonRepresentationArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			courseId,
			enrollmentId,
		} = args;

		// Get the base representation
		const baseResult = await tryGetSingleUserGradesJsonRepresentation({
			payload,
			user,
			req,
			overrideAccess,
			courseId,
			enrollmentId,
		});

		if (!baseResult.ok) {
			throw baseResult.error;
		}

		const baseData = baseResult.value;

		const allRepsResult = await tryGetGradebookAllRepresentations({
			payload,
			courseId: baseData.course_id,
			user: user
				? ({
					...user,
					collection: "users",
					avatar:
						typeof user.avatar === "object" && user.avatar !== null
							? user.avatar.id
							: user.avatar,
				} as TypedUser)
				: null,
			req,
			overrideAccess,
		});

		if (!allRepsResult.ok) {
			throw allRepsResult.error;
		}

		const gradebookSetup = allRepsResult.value.ui;

		// Adjust weights for each item using overall_weight from GradebookSetupForUI
		const adjustedItems = baseData.enrollment.items.map((item) => {
			const setupItem = findItemById(
				gradebookSetup.gradebook_setup.items,
				item.item_id,
			);

			if (setupItem && setupItem.overall_weight !== null) {
				return {
					...item,
					weight: setupItem.overall_weight,
				};
			}

			// If not found or overall_weight is null, keep original weight
			return item;
		});

		// Recalculate total_weight based on adjusted weights
		const adjustedTotalWeight = adjustedItems.reduce(
			(sum, item) => sum + item.weight,
			0,
		);

		// Build adjusted enrollment representation
		const adjustedEnrollment: UserGradeEnrollment = {
			...baseData.enrollment,
			items: adjustedItems,
			total_weight: adjustedTotalWeight,
		};

		const result: SingleUserGradesJsonRepresentation = {
			...baseData,
			enrollment: adjustedEnrollment,
		};

		return result;
	},
	(error) =>
		transformError(error) ??
		new UnknownError(
			"Failed to get adjusted single user grades JSON representation",
			{
				cause: error,
			},
		),
);

export interface GetAdjustedSingleUserGradesArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseId: number;
	enrollmentId: number;
}

export interface AdjustedSingleUserGradesResult {
	json: SingleUserGradesJsonRepresentation;
	yaml: string;
	markdown: string;
}

/**
 * Formats a number or null as a percentage string (for markdown)
 */
function formatPercentageForMarkdown(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return `${value.toFixed(2)}%`;
}

/**
 * Formats a number or null as a decimal string (for markdown)
 */
function formatNumberForMarkdown(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return value.toFixed(2);
}

/**
 * Gets the type display name for an item (for markdown)
 */
function getTypeDisplayNameForMarkdown(type: string): string {
	switch (type) {
		case "manual_item":
			return "Manual";
		case "page":
			return "Page";
		case "whiteboard":
			return "Whiteboard";
		case "assignment":
			return "Assignment";
		case "quiz":
			return "Quiz";
		case "discussion":
			return "Discussion";
		case "category":
			return "Category";
		default:
			return type;
	}
}

/**
 * Constructs JSON, YAML, and Markdown representations of a single user's grades in a course
 * This is more efficient than calling separate functions as it only queries the database once
 */
export const tryGetAdjustedSingleUserGrades = Result.wrap(
	async (
		args: GetAdjustedSingleUserGradesArgs,
	): Promise<AdjustedSingleUserGradesResult> => {
		// Get JSON representation first (this does the database queries)
		const jsonResult = await tryGetAdjustedSingleUserGradesJsonRepresentation({
			payload: args.payload,
			user: args.user,
			req: args.req,
			overrideAccess: args.overrideAccess,
			courseId: args.courseId,
			enrollmentId: args.enrollmentId,
		});

		if (!jsonResult.ok) {
			throw jsonResult.error;
		}

		const jsonData = jsonResult.value;
		const { enrollment, course_id, gradebook_id } = jsonData;

		// Convert JSON to YAML using Bun.YAML.stringify
		let yamlString: string;
		try {
			yamlString = Bun.YAML?.stringify(jsonData, null, 2);
			if (!yamlString) {
				throw new Error("Bun.YAML is not available");
			}
		} catch (error) {
			throw new Error(
				`Failed to convert JSON to YAML: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Get course information for markdown
		const course = await args.payload.findByID({
			collection: "courses",
			id: course_id,
			depth: 0,
			user: args.user,
			req: args.req,
			overrideAccess: args.overrideAccess,
		});

		if (!course) {
			throw new Error(`Course with ID ${course_id} not found`);
		}

		// Calculate total grade (sum of all base_grade values)
		const totalGrade = enrollment.items.reduce((sum, item) => {
			return (
				sum +
				(item.base_grade !== null && item.base_grade !== undefined
					? item.base_grade
					: 0)
			);
		}, 0);

		// Calculate total max grade
		const totalMaxGrade = enrollment.items.reduce((sum, item) => {
			return sum + (item.max_grade ?? 0);
		}, 0);

		// Build header
		const header = `# Single User Grade Report

**Course:** ${course.title || `Course ID ${course_id}`}

**Gradebook ID:** ${gradebook_id}

**Student:** ${enrollment.user_name} (${enrollment.user_email})

**Enrollment ID:** ${enrollment.enrollment_id}

## Grade Summary

| Item Name | Type | Weight | Max Grade | Base Grade | Override Grade | Status |
|-----------|------|--------|-----------|------------|----------------|--------|`;

		// Build grade items rows
		const itemRows = enrollment.items.map((item) => {
			const itemName = item.item_name;
			const typeStr = getTypeDisplayNameForMarkdown(item.item_type);
			const weightStr = formatPercentageForMarkdown(item.weight);
			const maxGradeStr = formatNumberForMarkdown(item.max_grade);
			const baseGradeStr =
				item.base_grade !== null && item.base_grade !== undefined
					? formatNumberForMarkdown(item.base_grade)
					: "-";
			const overrideGradeStr =
				item.is_overridden &&
					item.override_grade !== null &&
					item.override_grade !== undefined
					? formatNumberForMarkdown(item.override_grade)
					: "-";
			const statusStr =
				item.status === "graded"
					? "Graded"
					: item.status === "draft"
						? "Draft"
						: item.status;

			return `| ${itemName} | ${typeStr} | ${weightStr} | ${maxGradeStr} | ${baseGradeStr} | ${overrideGradeStr} | ${statusStr} |`;
		});

		const itemsSection = [header, ...itemRows].join("\n");

		// Build totals section
		const totalsSection = `
## Totals

| Metric | Value |
|--------|-------|
| Total Grade | ${totalGrade > 0 ? formatNumberForMarkdown(totalGrade) : "-"} |
| Total Max Grade | ${formatNumberForMarkdown(totalMaxGrade)} |
| Final Grade | ${enrollment.final_grade !== null && enrollment.final_grade !== undefined
				? formatNumberForMarkdown(enrollment.final_grade)
				: "-"
			} |
| Total Weight | ${formatPercentageForMarkdown(enrollment.total_weight)} |
| Graded Items | ${enrollment.graded_items} / ${enrollment.items.length} |`;

		// Combine all sections
		const rawMarkdown = [itemsSection, totalsSection].join("\n");

		const markdown = prettifyMarkdown(rawMarkdown);

		return {
			json: jsonData,
			yaml: yamlString,
			markdown,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get adjusted single user grades", {
			cause: error,
		}),
);

export interface ReleaseAssignmentGradeArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseActivityModuleLinkId: number;
	enrollmentId: number;
}

/**
 * Releases a grade from the latest assignment submission to the user-grade
 * Finds the latest graded submission for a student + assignment and updates the user-grade
 */
export const tryReleaseAssignmentGrade = Result.wrap(
	async (args: ReleaseAssignmentGradeArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			courseActivityModuleLinkId,
			enrollmentId,
		} = args;

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const requestWithTransaction = {
				...(req || {}),
				transactionID,
			} as PayloadRequest;

			// Get enrollment to get student ID
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				depth: 1,
				user,
				req: requestWithTransaction,
				overrideAccess,
			});

			if (!enrollment) {
				throw new EnrollmentNotFoundError(
					`Enrollment with ID ${enrollmentId} not found`,
				);
			}

			const studentId =
				typeof enrollment.user === "number"
					? enrollment.user
					: enrollment.user.id;

			// Find latest submission for this student + assignment
			const submissionsResult = await payload.find({
				collection: AssignmentSubmissions.slug,
				where: {
					and: [
						{
							courseModuleLink: {
								equals: courseActivityModuleLinkId,
							},
						},
						{
							student: {
								equals: studentId,
							},
						},
						{
							enrollment: {
								equals: enrollmentId,
							},
						},
						{
							status: {
								equals: "graded",
							},
						},
					],
				},
				sort: "-gradedAt", // Get latest graded submission
				limit: 1,
				depth: 1,
				user,
				req: requestWithTransaction,
				overrideAccess,
			});

			if (submissionsResult.docs.length === 0) {
				throw new NonExistingAssignmentSubmissionError(
					`No graded submission found for enrollment ${enrollmentId} and assignment ${courseActivityModuleLinkId}`,
				);
			}

			const latestSubmissionRaw = submissionsResult.docs[0];
			const latestSubmission =
				latestSubmissionRaw as typeof latestSubmissionRaw & {
					grade?: number | null;
					feedback?: string | null;
					gradedBy?: number | { id: number } | null;
				};

			// Check if submission has a grade
			if (
				latestSubmission.grade === null ||
				latestSubmission.grade === undefined
			) {
				throw new InvalidGradeValueError(
					"Latest submission does not have a grade",
				);
			}

			// Find gradebook item by course module link
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user,
				req: requestWithTransaction,
				overrideAccess,
				courseModuleLinkId: courseActivityModuleLinkId,
			});

			if (!gradebookItemResult.ok) {
				throw new GradebookItemNotFoundError(
					`Failed to find gradebook item: ${gradebookItemResult.error.message}`,
				);
			}

			const gradebookItem = gradebookItemResult.value;

			// Validate grade against gradebook item limits
			if (
				latestSubmission.grade < gradebookItem.minGrade ||
				latestSubmission.grade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Grade ${latestSubmission.grade} must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
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
				// Update existing grade with latest submission's data
				const updateResult = await tryUpdateUserGrade({
					payload,
					user,
					req: requestWithTransaction,
					overrideAccess,
					gradeId: existingGradeResult.value.id,
					baseGrade: latestSubmission.grade,
					feedback: latestSubmission.feedback || undefined,
					gradedBy:
						typeof latestSubmission.gradedBy === "number"
							? latestSubmission.gradedBy
							: latestSubmission.gradedBy?.id,
					submittedAt: latestSubmission.submittedAt || undefined,
					submission: latestSubmission.id,
					submissionType: "assignment",
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
					baseGrade: latestSubmission.grade,
					baseGradeSource: "submission",
					submission: latestSubmission.id,
					submissionType: "assignment",
					feedback: latestSubmission.feedback || undefined,
					gradedBy:
						typeof latestSubmission.gradedBy === "number"
							? latestSubmission.gradedBy
							: latestSubmission.gradedBy?.id,
					submittedAt: latestSubmission.submittedAt || undefined,
				});

				if (!createResult.ok) {
					throw new UnknownError("Failed to create user grade", {
						cause: createResult.error,
					});
				}

				userGrade = createResult.value;
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				submission: latestSubmission,
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
		new UnknownError("Failed to release assignment grade", {
			cause: error,
		}),
);

export interface ReleaseDiscussionGradeArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseActivityModuleLinkId: number;
	enrollmentId: number;
}

/**
 * Releases discussion grades to the user-grade
 * Calculates average grade from all graded discussion posts and updates the user-grade
 */
export const tryReleaseDiscussionGrade = Result.wrap(
	async (args: ReleaseDiscussionGradeArgs) => {
		const {
			payload,
			user = null,
			req,
			overrideAccess = false,
			courseActivityModuleLinkId,
			enrollmentId,
		} = args;

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const requestWithTransaction = {
				...(req || {}),
				transactionID,
			} as PayloadRequest;

			// Get enrollment to get student ID
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				depth: 1,
				user,
				req: requestWithTransaction,
				overrideAccess,
			});

			if (!enrollment) {
				throw new EnrollmentNotFoundError(
					`Enrollment with ID ${enrollmentId} not found`,
				);
			}

			const studentId =
				typeof enrollment.user === "number"
					? enrollment.user
					: enrollment.user.id;

			// Get all discussion submissions for this student
			const typedUser: TypedUser | null = user
				? ({
					...user,
					collection: "users",
					avatar:
						typeof user.avatar === "object" && user.avatar !== null
							? user.avatar.id
							: (user.avatar ?? undefined),
				} as TypedUser)
				: null;

			const submissionsResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId: courseActivityModuleLinkId,
				studentId,
				enrollmentId,
				status: "published",
				limit: 999999,
				page: 1,
				user: typedUser,
				req: requestWithTransaction,
				overrideAccess,
			});

			if (!submissionsResult.ok) {
				throw new UnknownError("Failed to get discussion submissions", {
					cause: submissionsResult.error,
				});
			}

			const submissions = submissionsResult.value;

			// Filter to only graded submissions and calculate average
			const gradedSubmissions = submissions.filter((sub) => {
				const subWithGrade = sub as typeof sub & {
					grade?: number | null;
				};
				return subWithGrade.grade !== null && subWithGrade.grade !== undefined;
			});

			if (gradedSubmissions.length === 0) {
				throw new InvalidGradeValueError(
					`No graded discussion posts found for enrollment ${enrollmentId} and discussion ${courseActivityModuleLinkId}`,
				);
			}

			// Calculate average grade (sum of all grades / count of graded posts)
			const totalGrade = gradedSubmissions.reduce((sum, sub) => {
				const subWithGrade = sub as typeof sub & {
					grade?: number | null;
				};
				return sum + (subWithGrade.grade || 0);
			}, 0);
			const averageGrade = totalGrade / gradedSubmissions.length;

			// Get the latest graded submission for feedback and gradedBy
			const latestGradedSubmission = gradedSubmissions.sort((a, b) => {
				const aWithGrade = a as typeof a & { gradedAt?: string | null };
				const bWithGrade = b as typeof b & { gradedAt?: string | null };
				const aDate = aWithGrade.gradedAt
					? new Date(aWithGrade.gradedAt).getTime()
					: 0;
				const bDate = bWithGrade.gradedAt
					? new Date(bWithGrade.gradedAt).getTime()
					: 0;
				return bDate - aDate;
			})[0];

			const latestWithGrade =
				latestGradedSubmission as typeof latestGradedSubmission & {
					feedback?: string | null;
					gradedBy?: number | { id: number } | null;
					gradedAt?: string | null;
				};

			// Combine feedback from all graded submissions
			const allFeedback = gradedSubmissions
				.map((sub) => {
					const subWithFeedback = sub as typeof sub & {
						feedback?: string | null;
					};
					return subWithFeedback.feedback;
				})
				.filter((fb) => fb && fb.trim() !== "")
				.join("\n\n");

			// Find gradebook item by course module link
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user,
				req: requestWithTransaction,
				overrideAccess,
				courseModuleLinkId: courseActivityModuleLinkId,
			});

			if (!gradebookItemResult.ok) {
				throw new GradebookItemNotFoundError(
					`Failed to find gradebook item: ${gradebookItemResult.error.message}`,
				);
			}

			const gradebookItem = gradebookItemResult.value;

			// Validate average grade against gradebook item limits
			if (
				averageGrade < gradebookItem.minGrade ||
				averageGrade > gradebookItem.maxGrade
			) {
				throw new InvalidGradeValueError(
					`Average grade ${averageGrade} must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
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
				// Update existing grade with average grade
				const updateResult = await tryUpdateUserGrade({
					payload,
					user,
					req: requestWithTransaction,
					overrideAccess,
					gradeId: existingGradeResult.value.id,
					baseGrade: averageGrade,
					feedback: allFeedback || undefined,
					gradedBy:
						typeof latestWithGrade.gradedBy === "number"
							? latestWithGrade.gradedBy
							: latestWithGrade.gradedBy?.id,
					submissionType: "discussion",
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
					baseGrade: averageGrade,
					baseGradeSource: "submission",
					submissionType: "discussion",
					feedback: allFeedback || undefined,
					gradedBy:
						typeof latestWithGrade.gradedBy === "number"
							? latestWithGrade.gradedBy
							: latestWithGrade.gradedBy?.id,
				});

				if (!createResult.ok) {
					throw new UnknownError("Failed to create user grade", {
						cause: createResult.error,
					});
				}

				userGrade = createResult.value;
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				averageGrade,
				gradedPostsCount: gradedSubmissions.length,
				totalPostsCount: submissions.length,
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
		new UnknownError("Failed to release discussion grade", {
			cause: error,
		}),
);

export interface ReleaseQuizGradeArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	courseActivityModuleLinkId: number;
	enrollmentId: number;
}

/**
 * Releases quiz grade to the user-grade
 * Currently not implemented
 */
export const tryReleaseQuizGrade = Result.wrap(
	async (_args: ReleaseQuizGradeArgs) => {
		throw new NotImplementedError("Quiz grade release is not yet implemented");
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to release quiz grade", {
			cause: error,
		}),
);
