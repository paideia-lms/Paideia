import { AssignmentSubmissions } from "server/collections";
import type { LatestCourseModuleSettings } from "server/json";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingAssignmentSubmissionError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { DEFAULT_ALLOWED_FILE_TYPES } from "~/utils/file-types";
import { tryFindCourseActivityModuleLinkById } from "./course-activity-module-link-management";
import { tryFindGradebookItemByCourseModuleLink } from "./gradebook-item-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type BaseInternalFunctionArgs,
	stripDepth,
} from "./utils/internal-function-utils";

type AssignmentSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "assignment" }
>;

export type CreateAssignmentSubmissionArgs = BaseInternalFunctionArgs & {
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
};

export type UpdateAssignmentSubmissionArgs = BaseInternalFunctionArgs & {
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
};

export type GradeAssignmentSubmissionArgs = BaseInternalFunctionArgs & {
	id: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
};

export type GetAssignmentSubmissionByIdArgs = BaseInternalFunctionArgs & {
	id: number | string;
};

export type DeleteAssignmentSubmissionArgs = BaseInternalFunctionArgs & {
	id: number;
};

export type ListAssignmentSubmissionsArgs = BaseInternalFunctionArgs & {
	courseModuleLinkId?: number;
	studentId?: number;
	enrollmentId?: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	limit?: number;
	page?: number;
};

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

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Check if submission already exists for this attempt
			const existingSubmission = await payload
				.find({
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
				})
				.then(stripDepth<1, "find">());

			if (existingSubmission.docs.length > 0) {
				throw new InvalidArgumentError(
					`Submission already exists for attempt ${attemptNumber}`,
				);
			}

			// Get course module link to access assignment
			const courseModuleLinkResult = await tryFindCourseActivityModuleLinkById({
				payload,
				linkId: courseModuleLinkId,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			if (!courseModuleLinkResult.ok) {
				throw new InvalidArgumentError("Course module link not found");
			}

			const courseModuleLink = courseModuleLinkResult.value;

			// Get assignment from activity module (discriminated union)
			const activityModule = courseModuleLink.activityModule;

			// Extract assignment data for validation (only available for assignment type)
			const assignmentForValidation =
				activityModule.type === "assignment"
					? {
							allowedFileTypes: activityModule.allowedFileTypes ?? null,
							maxFileSize: activityModule.maxFileSize ?? null,
							maxFiles: activityModule.maxFiles ?? null,
						}
					: null;

			// Validate file attachments if provided
			if (attachments && attachments.length > 0) {
				const mediaFileIds = attachments.map((a) => a.file);
				const mediaFiles = await payload
					.find({
						collection: "media",
						where: {
							id: { in: mediaFileIds },
						},
						depth: 1,
						user,
						req: reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "find">());

				validateFileAttachments(
					attachments,
					assignmentForValidation,
					mediaFiles.docs,
				);
			}

			const assignmentSettings =
				courseModuleLink?.settings as unknown as AssignmentSettings;

			const isLate = assignmentSettings?.dueDate
				? new Date() > new Date(assignmentSettings.dueDate)
				: false;

			const submission = await payload
				.create({
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
				})
				.then(stripDepth<1, "create">());
			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const courseModuleLinkRef = submission.courseModuleLink;

			const student = submission.student;

			const enrollment = submission.enrollment;

			return {
				...submission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
		});
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
		const { payload, id, req, overrideAccess = false } = args;

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

			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
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

				const courseModuleLinkResult =
					await tryFindCourseActivityModuleLinkById({
						payload,
						linkId: courseModuleLinkId,
						user,
						req: reqWithTransaction,
						overrideAccess,
					});

				if (!courseModuleLinkResult.ok) {
					throw new InvalidArgumentError("Course module link not found");
				}

				const courseModuleLink = courseModuleLinkResult.value;
				const activityModule = courseModuleLink.activityModule;

				// Extract assignment data for validation (only available for assignment type)
				const assignmentForValidation =
					activityModule.type === "assignment"
						? {
								allowedFileTypes: activityModule.allowedFileTypes ?? null,
								maxFileSize: activityModule.maxFileSize ?? null,
								maxFiles: activityModule.maxFiles ?? null,
							}
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
						assignmentForValidation,
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

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update assignment submission", {
			cause: error,
		}),
);

export type SubmitAssignmentArgs = BaseInternalFunctionArgs & {
	submissionId: number;
};

/**
 * Submits an assignment (changes status from draft to submitted)
 */
export const trySubmitAssignment = Result.wrap(
	async (args: SubmitAssignmentArgs) => {
		const {
			payload,
			submissionId,

			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!submissionId) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
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
			const updatedSubmission = await payload
				.update({
					collection: "assignment-submissions",
					id: submissionId,
					data: {
						status: "submitted",
						submittedAt: new Date().toISOString(),
					},
					depth: 1,
					user,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;

			const student = updatedSubmission.student;

			const enrollment = updatedSubmission.enrollment;
			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
		});
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
			req,
			id,
			grade,
			feedback,
			gradedBy,

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

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
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

			// Fetch the updated submission with depth for return value
			const updatedSubmission = await payload
				.findByID({
					collection: AssignmentSubmissions.slug,
					id,
					depth: 1,
					user,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedSubmission) {
				throw new NonExistingAssignmentSubmissionError(
					`Failed to fetch updated submission with id '${id}'`,
				);
			}

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;

			const student = updatedSubmission.student;

			const enrollment = updatedSubmission.enrollment;

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
				student,
				enrollment,
			};
		});
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
		const { payload, id, req, overrideAccess = false } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Assignment submission ID is required");
		}

		const deletedSubmission = await payload.delete({
			collection: "assignment-submissions",
			id,
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
