import type { Payload } from "payload";
import { AssignmentSubmissions, Assignments } from "server/collections";
import { assertZodInternal } from "server/utils/type-narrowing";
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
	courseModuleLinkId: number;
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
	courseModuleLinkId?: number;
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
			courseModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			content,
			attachments,
			timeSpent,
		} = args;

		// Validate required fields
		if (!courseModuleLinkId) {
			throw new InvalidArgumentError("Course module link ID is required");
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
					{ courseModuleLink: { equals: courseModuleLinkId } },
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

		// Get course module link to access assignment
		const courseModuleLink = await payload.findByID({
			collection: "course-activity-module-links",
			id: courseModuleLinkId,
			depth: 2, // Need to get activity module and assignment
		});

		if (!courseModuleLink) {
			throw new InvalidArgumentError("Course module link not found");
		}

		// Get assignment from activity module
		const activityModule =
			typeof courseModuleLink.activityModule === "object"
				? courseModuleLink.activityModule
				: null;
		const assignment =
			activityModule && typeof activityModule.assignment === "object"
				? activityModule.assignment
				: null;

		const isLate =
			assignment && assignment.dueDate
				? new Date() > new Date(assignment.dueDate)
				: false;

		const submission = await payload.create({
			collection: "assignment-submissions",
			data: {
				courseModuleLink: courseModuleLinkId,
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

		const courseModuleLinkRef = submission.courseModuleLink;
		assertZodInternal(
			"tryCreateAssignmentSubmission: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZodInternal(
			"tryCreateAssignmentSubmission: Student is required",
			student,
			z.object({ id: z.number() }),
		);

		const enrollment = submission.enrollment;
		assertZodInternal(
			"tryCreateAssignmentSubmission: Enrollment is required",
			enrollment,
			z.object({ id: z.number() }),
		);

		return {
			...submission,
			courseModuleLink: courseModuleLinkRef,
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

		const courseModuleLinkRef = submission.courseModuleLink;
		assertZodInternal(
			"tryGetAssignmentSubmissionById: Course module link is required",
			courseModuleLinkRef,
			z.object({ id: z.number() }),
		);

		const student = submission.student;
		assertZodInternal(
			"tryGetAssignmentSubmissionById: Student is required",
			student,
			z.object({ id: z.number() }),
		);

		const enrollment = submission.enrollment;
		assertZodInternal(
			"tryGetAssignmentSubmissionById: Enrollment is required",
			enrollment,
			z.object({ id: z.number() }),
		);

		return {
			...submission,
			courseModuleLink: courseModuleLinkRef,
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

		const courseModuleLinkRef = updatedSubmission.courseModuleLink;
		assertZodInternal(
			"tryUpdateAssignmentSubmission: Course module link is required",
			courseModuleLinkRef,
			z.object({ id: z.number() }),
		);

		const student = updatedSubmission.student;
		assertZodInternal(
			"tryUpdateAssignmentSubmission: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZodInternal(
			"tryUpdateAssignmentSubmission: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			courseModuleLink: courseModuleLinkRef,
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

		const courseModuleLinkRef = updatedSubmission.courseModuleLink;
		assertZodInternal(
			"trySubmitAssignment: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZodInternal(
			"trySubmitAssignment: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZodInternal(
			"trySubmitAssignment: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			courseModuleLink: courseModuleLinkRef,
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

			// Note: No need to verify assignment exists separately as it's accessed
			// through the course module link relationship

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
				transactionID,
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

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;
			assertZodInternal(
				"tryGradeAssignmentSubmission: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZodInternal(
				"tryGradeAssignmentSubmission: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZodInternal(
				"tryGradeAssignmentSubmission: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
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
			courseModuleLinkId,
			studentId,
			enrollmentId,
			status,
			limit = 10,
			page = 1,
		} = args;

		const where: Record<string, { equals: unknown }> = {};

		if (courseModuleLinkId) {
			where.courseModuleLink = {
				equals: courseModuleLinkId,
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
			assertZodInternal(
				"tryListAssignmentSubmissions: Course module link is required",
				doc.courseModuleLink,
				z.object({
					id: z.number(),
				}),
			);
			assertZodInternal(
				"tryListAssignmentSubmissions: Student is required",
				doc.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZodInternal(
				"tryListAssignmentSubmissions: Enrollment is required",
				doc.enrollment,
				z.object({
					id: z.number(),
				}),
			);
			return {
				...doc,
				courseModuleLink: doc.courseModuleLink.id,
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
