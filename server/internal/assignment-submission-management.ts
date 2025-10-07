import type { Payload } from "payload";
import { AssignmentSubmissions, Assignments } from "server/collections";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingAssignmentSubmissionError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryCreateUserGrade } from "./user-grade-management";

export interface CreateAssignmentSubmissionArgs {
	activityModuleId: number;
	assignmentId: number;
	studentId: number;
	enrollmentId: number;
	attemptNumber?: number;
	content?: string;
	attachments?: Array<{
		file: number;
		description?: string;
	}>;
	timeSpent?: number;
}

export interface UpdateAssignmentSubmissionArgs {
	id: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	content?: string;
	attachments?: Array<{
		file: number;
		description?: string;
	}>;
	timeSpent?: number;
}

export interface GradeAssignmentSubmissionArgs {
	id: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
	enrollmentId: number;
	gradebookItemId: number;
	submittedAt?: string;
}

export interface GetAssignmentSubmissionByIdArgs {
	id: number | string;
}

export interface ListAssignmentSubmissionsArgs {
	activityModuleId?: number;
	assignmentId?: number;
	studentId?: number;
	enrollmentId?: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	limit?: number;
	page?: number;
}

/**
 * Creates a new assignment submission using Payload local API
 */
export const tryCreateAssignmentSubmission = Result.wrap(
	async (payload: Payload, args: CreateAssignmentSubmissionArgs) => {
		const {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			content,
			attachments,
			timeSpent,
		} = args;

		// Validate required fields
		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}
		if (!assignmentId) {
			throw new InvalidArgumentError("Assignment ID is required");
		}
		if (!studentId) {
			throw new InvalidArgumentError("Student ID is required");
		}
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		// Check if submission already exists for this attempt
		const existingSubmission = await payload.find({
			collection: "assignment-submissions",
			where: {
				and: [
					{ activityModule: { equals: activityModuleId } },
					{ student: { equals: studentId } },
					{ attemptNumber: { equals: attemptNumber } },
				],
			},
		});

		if (existingSubmission.docs.length > 0) {
			throw new InvalidArgumentError(
				`Submission already exists for attempt ${attemptNumber}`,
			);
		}

		// Get assignment to check due date and calculate if late
		const assignment = await payload.findByID({
			collection: "assignments",
			id: assignmentId,
		});

		if (!assignment) {
			throw new InvalidArgumentError("Assignment not found");
		}

		const isLate = assignment.dueDate
			? new Date() > new Date(assignment.dueDate)
			: false;

		const submission = await payload.create({
			collection: "assignment-submissions",
			data: {
				activityModule: activityModuleId,
				assignment: assignmentId,
				student: studentId,
				enrollment: enrollmentId,
				attemptNumber,
				status: "draft",
				content,
				attachments,
				isLate,
				timeSpent,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = submission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const assignmentRef = submission.assignment;
		assertZod(
			assignmentRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			activityModule,
			assignment: assignmentRef,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create assignment submission", {
			cause: error,
		}),
);

/**
 * Get an assignment submission by ID
 */
export const tryGetAssignmentSubmissionById = Result.wrap(
	async (payload: Payload, args: GetAssignmentSubmissionByIdArgs) => {
		const { id } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Fetch the assignment submission
		const submissionResult = await payload.find({
			collection: "assignment-submissions",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth: 1, // Fetch related data
		});

		const submission = submissionResult.docs[0];

		if (!submission) {
			throw new NonExistingAssignmentSubmissionError(
				`Assignment submission with id '${id}' not found`,
			);
		}

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = submission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const assignment = submission.assignment;
		assertZod(
			assignment,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			activityModule,
			assignment,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get assignment submission", {
			cause: error,
		}),
);

/**
 * Updates an assignment submission
 */
export const tryUpdateAssignmentSubmission = Result.wrap(
	async (payload: Payload, args: UpdateAssignmentSubmissionArgs) => {
		const { id, status, content, attachments, timeSpent } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Build update data object
		const updateData: Record<string, unknown> = {};
		if (status !== undefined) updateData.status = status;
		if (content !== undefined) updateData.content = content;
		if (attachments !== undefined) updateData.attachments = attachments;
		if (timeSpent !== undefined) updateData.timeSpent = timeSpent;

		// If status is being changed to submitted, set submittedAt
		if (status === "submitted") {
			updateData.submittedAt = new Date().toISOString();
		}

		// Validate that at least one field is being updated
		if (Object.keys(updateData).length === 0) {
			throw new InvalidArgumentError(
				"At least one field must be provided for update",
			);
		}

		const updatedSubmission = await payload.update({
			collection: "assignment-submissions",
			id,
			data: updateData,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const assignment = updatedSubmission.assignment;
		assertZod(
			assignment,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			activityModule,
			assignment,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update assignment submission", {
			cause: error,
		}),
);

/**
 * Submits an assignment (changes status from draft to submitted)
 */
export const trySubmitAssignment = Result.wrap(
	async (payload: Payload, submissionId: number) => {
		// Validate ID
		if (!submissionId) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Get the current submission
		const currentSubmission = await payload.findByID({
			collection: "assignment-submissions",
			id: submissionId,
		});

		if (!currentSubmission) {
			throw new NonExistingAssignmentSubmissionError(
				`Assignment submission with id '${submissionId}' not found`,
			);
		}

		if (currentSubmission.status !== "draft") {
			throw new InvalidArgumentError("Only draft submissions can be submitted");
		}

		// Update status to submitted
		const updatedSubmission = await payload.update({
			collection: "assignment-submissions",
			id: submissionId,
			data: {
				status: "submitted",
				submittedAt: new Date().toISOString(),
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const assignment = updatedSubmission.assignment;
		assertZod(
			assignment,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			activityModule,
			assignment,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to submit assignment", {
			cause: error,
		}),
);

/**
 * Grades an assignment submission and creates gradebook entry
 */
export const tryGradeAssignmentSubmission = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: GradeAssignmentSubmissionArgs,
	) => {
		const {
			id,
			grade,
			feedback,
			gradedBy,
			enrollmentId,
			gradebookItemId,
			submittedAt,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Validate grade
		if (grade < 0) {
			throw new InvalidArgumentError("Grade cannot be negative");
		}

		// Validate required gradebook fields
		if (!enrollmentId) {
			throw new InvalidArgumentError(
				"Enrollment ID is required for gradebook integration",
			);
		}
		if (!gradebookItemId) {
			throw new InvalidArgumentError(
				"Gradebook item ID is required for gradebook integration",
			);
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get the current submission
			const currentSubmission = await payload.findByID({
				collection: AssignmentSubmissions.slug,
				id,
				req: { transactionID },
			});

			if (!currentSubmission) {
				throw new NonExistingAssignmentSubmissionError(
					`Assignment submission with id '${id}' not found`,
				);
			}

			if (currentSubmission.status !== "submitted") {
				throw new InvalidArgumentError(
					"Only submitted assignments can be graded",
				);
			}

			// Get assignment to verify it exists
			const assignment = await payload.findByID({
				collection: Assignments.slug,
				id: currentSubmission.assignment as number,
				req: { transactionID },
			});

			if (!assignment) {
				throw new InvalidArgumentError("Assignment not found");
			}

			// Update submission with grade
			const updatedSubmission = await payload.update({
				collection: AssignmentSubmissions.slug,
				id,
				data: {
					status: "graded",
				},
				req: { transactionID },
			});

			// Create user grade in gradebook
			const userGradeResult = await tryCreateUserGrade(payload, request, {
				enrollmentId,
				gradebookItemId,
				baseGrade: grade,
				baseGradeSource: "submission",
				submission: id,
				submissionType: "assignment",
				feedback,
				gradedBy,
				submittedAt: submittedAt || updatedSubmission.submittedAt || undefined,
			});

			if (!userGradeResult.ok) {
				throw new Error(
					`Failed to create gradebook entry: ${userGradeResult.error}`,
				);
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const activityModule = updatedSubmission.activityModule;
			assertZod(
				activityModule,
				z.object({
					id: z.number(),
				}),
			);

			const assignmentRef = updatedSubmission.assignment;
			assertZod(
				assignmentRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZod(
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZod(
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				activityModule,
				assignment: assignmentRef,
				student,
				enrollment,
				grade,
				feedback,
				gradedBy,
				userGrade: userGradeResult.value,
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

/**
 * Lists assignment submissions with optional filtering
 */
export const tryListAssignmentSubmissions = Result.wrap(
	async (payload: Payload, args: ListAssignmentSubmissionsArgs = {}) => {
		const {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			status,
			limit = 10,
			page = 1,
		} = args;

		const where: Record<string, { equals: unknown }> = {};

		if (activityModuleId) {
			where.activityModule = {
				equals: activityModuleId,
			};
		}

		if (assignmentId) {
			where.assignment = {
				equals: assignmentId,
			};
		}

		if (studentId) {
			where.student = {
				equals: studentId,
			};
		}

		if (enrollmentId) {
			where.enrollment = {
				equals: enrollmentId,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		const result = await payload.find({
			collection: "assignment-submissions",
			where,
			limit,
			page,
			sort: "-createdAt",
			depth: 1, // Fetch related data
		});

		// type narrowing
		const docs = result.docs.map((doc) => {
			assertZod(
				doc.activityModule,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.assignment,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.enrollment,
				z.object({
					id: z.number(),
				}),
			);
			return {
				...doc,
				activityModule: doc.activityModule,
				assignment: doc.assignment,
				student: doc.student,
				enrollment: doc.enrollment,
			};
		});

		return {
			docs,
			totalDocs: result.totalDocs,
			totalPages: result.totalPages,
			page: result.page,
			limit: result.limit,
			hasNextPage: result.hasNextPage,
			hasPrevPage: result.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to list assignment submissions", {
			cause: error,
		}),
);

/**
 * Deletes an assignment submission
 */
export const tryDeleteAssignmentSubmission = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Check if submission exists
		const existingSubmission = await payload.findByID({
			collection: "assignment-submissions",
			id,
		});

		if (!existingSubmission) {
			throw new NonExistingAssignmentSubmissionError(
				`Assignment submission with id '${id}' not found`,
			);
		}

		const deletedSubmission = await payload.delete({
			collection: "assignment-submissions",
			id,
		});

		return deletedSubmission;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete assignment submission", {
			cause: error,
		}),
);
