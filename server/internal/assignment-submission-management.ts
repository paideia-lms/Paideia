import type { Payload, PayloadRequest, TypedUser } from "payload";
import { AssignmentSubmissions } from "server/collections";
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
import { DEFAULT_ALLOWED_FILE_TYPES } from "~/utils/file-types";
import { tryFindGradebookItemByCourseModuleLink } from "./gradebook-item-management";

export interface CreateAssignmentSubmissionArgs {
	payload: Payload;
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
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateAssignmentSubmissionArgs {
	payload: Payload;
	id: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	content?: string;
	attachments?: Array<
		| number
		| {
				file: number;
				description?: string;
		  }
	>;
	timeSpent?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GradeAssignmentSubmissionArgs {
	payload: Payload;
	request: Request;
	id: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
	user?: TypedUser | null;
	overrideAccess?: boolean;
}

export interface GetAssignmentSubmissionByIdArgs {
	payload: Payload;
	id: number | string;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteAssignmentSubmissionArgs {
	payload: Payload;
	id: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface ListAssignmentSubmissionsArgs {
	payload: Payload;
	courseModuleLinkId?: number;
	studentId?: number;
	enrollmentId?: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	limit?: number;
	page?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Validates file attachments against assignment configuration
 */
function validateFileAttachments(
	attachments: Array<{ file: number; description?: string }> | undefined,
	assignment: {
		allowedFileTypes?: Array<{ extension: string; mimeType: string }> | null;
		maxFileSize?: number | null;
		maxFiles?: number | null;
	} | null,
	mediaFiles: Array<{
		id: number;
		mimeType?: string | null;
		filesize?: number | null;
	}>,
): void {
	if (!attachments || attachments.length === 0) {
		return;
	}

	// Check max files
	const maxFiles = assignment?.maxFiles ?? 5;
	if (attachments.length > maxFiles) {
		throw new InvalidArgumentError(
			`Cannot upload more than ${maxFiles} file${maxFiles !== 1 ? "s" : ""}`,
		);
	}

	// Get allowed file types (use defaults if not configured)
	const allowedFileTypes =
		assignment?.allowedFileTypes && assignment.allowedFileTypes.length > 0
			? assignment.allowedFileTypes
			: DEFAULT_ALLOWED_FILE_TYPES;

	const allowedMimeTypes = allowedFileTypes.map((ft) => ft.mimeType);
	const maxFileSize = (assignment?.maxFileSize ?? 10) * 1024 * 1024; // Convert MB to bytes

	// Validate each file
	for (const attachment of attachments) {
		const mediaFile = mediaFiles.find((mf) => mf.id === attachment.file);
		if (!mediaFile) {
			throw new InvalidArgumentError(
				`File with ID ${attachment.file} not found`,
			);
		}

		// Validate MIME type
		if (mediaFile.mimeType && !allowedMimeTypes.includes(mediaFile.mimeType)) {
			const allowedExtensions = allowedFileTypes
				.map((ft) => ft.extension)
				.join(", ");
			throw new InvalidArgumentError(
				`File type "${mediaFile.mimeType}" is not allowed. Allowed types: ${allowedExtensions}`,
			);
		}

		// Validate file size
		if (mediaFile.filesize && mediaFile.filesize > maxFileSize) {
			const maxSizeMB = assignment?.maxFileSize ?? 10;
			throw new InvalidArgumentError(
				`File size exceeds maximum of ${maxSizeMB}MB`,
			);
		}
	}
}

/**
 * Creates a new assignment submission using Payload local API
 */
export const tryCreateAssignmentSubmission = Result.wrap(
	async (args: CreateAssignmentSubmissionArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			content,
			attachments,
			timeSpent,
			user = null,
			req,
			overrideAccess = false,
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
				user,
				req: reqWithTransaction,
				overrideAccess,
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
				user,
				req: reqWithTransaction,
				overrideAccess,
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

			// Validate file attachments if provided
			if (attachments && attachments.length > 0) {
				const mediaFileIds = attachments.map((a) => a.file);
				const mediaFiles = await payload.find({
					collection: "media",
					where: {
						id: { in: mediaFileIds },
					},
					user,
					req: reqWithTransaction,
					overrideAccess,
				});

				validateFileAttachments(attachments, assignment, mediaFiles.docs);
			}

			const isLate = assignment?.dueDate
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
				user,
				req: reqWithTransaction,
				overrideAccess,
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

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return {
				...submission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
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
		new UnknownError("Failed to create assignment submission", {
			cause: error,
		}),
);

/**
 * Get an assignment submission by ID
 */
export const tryGetAssignmentSubmissionById = Result.wrap(
	async (args: GetAssignmentSubmissionByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

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
			user,
			req,
			overrideAccess,
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
	async (args: UpdateAssignmentSubmissionArgs) => {
		const {
			payload,
			id,
			status,
			content,
			attachments,
			timeSpent,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
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
			// Get existing submission to access assignment configuration
			const existingSubmission = await payload.findByID({
				collection: "assignment-submissions",
				id,
				depth: 0,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			if (!existingSubmission) {
				throw new NonExistingAssignmentSubmissionError(
					`Assignment submission with id '${id}' not found`,
				);
			}

			// Validate file attachments if being updated
			if (attachments !== undefined && attachments.length > 0) {
				// Get course module link to access assignment
				const courseModuleLinkId =
					typeof existingSubmission.courseModuleLink === "object"
						? existingSubmission.courseModuleLink.id
						: existingSubmission.courseModuleLink;

				const courseModuleLink = await payload.findByID({
					collection: "course-activity-module-links",
					id: courseModuleLinkId,
					depth: 2,
					user,
					req: reqWithTransaction,
					overrideAccess,
				});

				const activityModule =
					typeof courseModuleLink.activityModule === "object"
						? courseModuleLink.activityModule
						: null;
				const assignment =
					activityModule && typeof activityModule.assignment === "object"
						? activityModule.assignment
						: null;

				// Extract file IDs from attachments (could be numbers or objects)
				const fileIds = attachments
					.map((a) => (typeof a === "number" ? a : a.file))
					.filter((id): id is number => typeof id === "number");

				if (fileIds.length > 0) {
					const mediaFiles = await payload.find({
						collection: "media",
						where: {
							id: { in: fileIds },
						},
						user,
						req: reqWithTransaction,
						overrideAccess,
					});

					// Convert attachments to proper format for validation
					const attachmentsForValidation = attachments.map((a) =>
						typeof a === "number" ? { file: a } : a,
					);

					validateFileAttachments(
						attachmentsForValidation,
						assignment,
						mediaFiles.docs,
					);
				}
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
				user,
				req: reqWithTransaction,
				overrideAccess,
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

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
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
		new UnknownError("Failed to update assignment submission", {
			cause: error,
		}),
);

export interface SubmitAssignmentArgs {
	payload: Payload;
	submissionId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Submits an assignment (changes status from draft to submitted)
 */
export const trySubmitAssignment = Result.wrap(
	async (args: SubmitAssignmentArgs) => {
		const {
			payload,
			submissionId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!submissionId) {
			throw new InvalidArgumentError("Assignment submission ID is required");
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
			// Get the current submission
			const currentSubmission = await payload.findByID({
				collection: "assignment-submissions",
				id: submissionId,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			if (!currentSubmission) {
				throw new NonExistingAssignmentSubmissionError(
					`Assignment submission with id '${submissionId}' not found`,
				);
			}

			if (currentSubmission.status !== "draft") {
				throw new InvalidArgumentError(
					"Only draft submissions can be submitted",
				);
			}

			// Update status to submitted
			const updatedSubmission = await payload.update({
				collection: "assignment-submissions",
				id: submissionId,
				data: {
					status: "submitted",
					submittedAt: new Date().toISOString(),
				},
				user,
				req: reqWithTransaction,
				overrideAccess,
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

			// Commit transaction only if we created it
			if (!transactionWasProvided) {
				await payload.db.commitTransaction(transactionID);
			}

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
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
		new UnknownError("Failed to submit assignment", {
			cause: error,
		}),
);

/**
 * Grades an assignment submission by updating the submission with grade and feedback
 * This does NOT update user-grades - use tryReleaseAssignmentGrade to release grades to gradebook
 */
export const tryGradeAssignmentSubmission = Result.wrap(
	async (args: GradeAssignmentSubmissionArgs) => {
		const {
			payload,
			request,
			id,
			grade,
			feedback,
			gradedBy,
			user = null,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Validate grade
		if (grade < 0) {
			throw new InvalidArgumentError("Grade cannot be negative");
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Construct req with transactionID
			const reqWithTransaction: Partial<PayloadRequest> = {
				...request,
				transactionID,
			};

			// Get the current submission with depth to access course module link
			const currentSubmission = await payload.findByID({
				collection: AssignmentSubmissions.slug,
				id,
				depth: 1,
				user,
				req: reqWithTransaction,
				overrideAccess,
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

			// Optionally validate grade against gradebook item limits if gradebook item exists
			const courseModuleLinkId =
				typeof currentSubmission.courseModuleLink === "number"
					? currentSubmission.courseModuleLink
					: currentSubmission.courseModuleLink.id;

			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user,
				req: reqWithTransaction,
				overrideAccess,
				courseModuleLinkId,
			});

			if (gradebookItemResult.ok) {
				const gradebookItem = gradebookItemResult.value;
				if (grade < gradebookItem.minGrade || grade > gradebookItem.maxGrade) {
					throw new InvalidArgumentError(
						`Grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
					);
				}
			}

			const now = new Date().toISOString();

			// Update submission with grade, feedback, gradedBy, gradedAt, and status
			// Note: Using Record<string, unknown> because Payload types haven't been regenerated yet
			await payload.update({
				collection: AssignmentSubmissions.slug,
				id,
				data: {
					grade,
					feedback,
					gradedBy,
					gradedAt: now,
					status: "graded",
				} as Record<string, unknown>,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			// Fetch the updated submission with depth for return value
			const updatedSubmission = await payload.findByID({
				collection: AssignmentSubmissions.slug,
				id,
				depth: 1,
				user,
				req: { ...request },
				overrideAccess,
			});

			if (!updatedSubmission) {
				throw new NonExistingAssignmentSubmissionError(
					`Failed to fetch updated submission with id '${id}'`,
				);
			}

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
	async (args: ListAssignmentSubmissionsArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			enrollmentId,
			status,
			limit = 10,
			page = 1,
			user = null,
			req,
			overrideAccess = false,
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
			user,
			req,
			overrideAccess,
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
	async (args: DeleteAssignmentSubmissionArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		// Check if submission exists
		const existingSubmission = await payload.findByID({
			collection: "assignment-submissions",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingSubmission) {
			throw new NonExistingAssignmentSubmissionError(
				`Assignment submission with id '${id}' not found`,
			);
		}

		const deletedSubmission = await payload.delete({
			collection: "assignment-submissions",
			id,
			user,
			req,
			overrideAccess,
		});

		return deletedSubmission;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete assignment submission", {
			cause: error,
		}),
);
