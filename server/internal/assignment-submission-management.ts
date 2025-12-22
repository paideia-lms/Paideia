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
import { tryCreateMedia } from "./media-management";

type AssignmentSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "assignment" }
>;

export interface CreateAssignmentSubmissionArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
	attemptNumber?: number;
	content?: string;
	attachments?: File[];
	timeSpent?: number;
}

export interface GradeAssignmentSubmissionArgs
	extends BaseInternalFunctionArgs {
	id: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
}

export interface GetAssignmentSubmissionByIdArgs
	extends BaseInternalFunctionArgs {
	id: number | string;
}

export interface DeleteAssignmentSubmissionArgs
	extends BaseInternalFunctionArgs {
	id: number;
}

export interface ListAssignmentSubmissionsArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId?: number;
	studentId?: number;
	enrollmentId?: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	limit?: number;
	page?: number;
}

/**
 * Validates file attachments against assignment configuration
 */
function validateFileAttachments(
	attachments: File[],
	restriction: {
		allowedFileTypes?: Array<{ extension: string; mimeType: string }> | null;
		maxFileSize?: number | null;
		maxFiles?: number | null;
	} | null,
): void {
	if (!attachments || attachments.length === 0) {
		return;
	}

	// Check max files
	const maxFiles = restriction?.maxFiles ?? 5;
	if (attachments.length > maxFiles) {
		throw new InvalidArgumentError(
			`Cannot upload more than ${maxFiles} file${maxFiles !== 1 ? "s" : ""}`,
		);
	}

	// Get allowed file types (use defaults if not configured)
	const allowedFileTypes =
		restriction?.allowedFileTypes && restriction.allowedFileTypes.length > 0
			? restriction.allowedFileTypes
			: DEFAULT_ALLOWED_FILE_TYPES;

	const allowedMimeTypes = allowedFileTypes.map((ft) => ft.mimeType);
	const maxFileSize = (restriction?.maxFileSize ?? 10) * 1024 * 1024; // Convert MB to bytes

	// Validate each file
	for (const attachment of attachments) {
		// Validate MIME type
		if (attachment.type && !allowedMimeTypes.includes(attachment.type)) {
			const allowedExtensions = allowedFileTypes
				.map((ft) => ft.extension)
				.join(", ");
			throw new InvalidArgumentError(
				`File type "${attachment.type}" is not allowed. Allowed types: ${allowedExtensions}`,
			);
		}

		// Validate file size
		if (attachment.size && attachment.size > maxFileSize) {
			const maxSizeMB = restriction?.maxFileSize ?? 10;
			throw new InvalidArgumentError(
				`File size exceeds maximum of ${maxSizeMB}MB`,
			);
		}
	}
}

/**
 * Creates a new assignment submission using Payload local API
 */
export function tryCreateAssignmentSubmission(
	args: CreateAssignmentSubmissionArgs,
) {
	return Result.try(
		async () => {
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
				const courseModuleLink = await tryFindCourseActivityModuleLinkById({
					payload,
					linkId: courseModuleLinkId,
					req: reqWithTransaction,
					overrideAccess,
				}).getOrThrow();

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
					validateFileAttachments(attachments, assignmentForValidation);
				}

				const assignmentSettings =
					courseModuleLink?.settings as unknown as AssignmentSettings;

				const isLate = assignmentSettings?.dueDate
					? new Date() > new Date(assignmentSettings.dueDate)
					: false;

				const now = new Date().toISOString();
				const submission = await payload
					.create({
						collection: "assignment-submissions",
						data: {
							courseModuleLink: courseModuleLinkId,
							student: studentId,
							enrollment: enrollmentId,
							attemptNumber,
							// ! we don't support draft submissions yet
							status: "submitted",
							submittedAt: now,
							content,
							attachments: attachments
								? await Promise.all(
										attachments.map(async (attachment) =>
											tryCreateMedia({
												payload,
												file: Buffer.from(await attachment.arrayBuffer()),
												filename: attachment.name,
												mimeType: attachment.type,
												alt: attachment.name,
												caption: attachment.name,
												userId: studentId,
												req: reqWithTransaction,
												overrideAccess,
											})
												.getOrThrow()
												.then((result) => ({
													file: result.media.id,
													description: attachment.name,
												})),
										),
									)
								: [],
							isLate,
							timeSpent,
						},
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
}

/**
 * Get an assignment submission by ID
 */
export function tryGetAssignmentSubmissionById(
	args: GetAssignmentSubmissionByIdArgs,
) {
	return Result.try(
		async () => {
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
}

/**
 * Grades an assignment submission by updating the submission with grade and feedback
 * This does NOT update user-grades - use tryReleaseAssignmentGrade to release grades to gradebook
 */
export function tryGradeAssignmentSubmission(
	args: GradeAssignmentSubmissionArgs,
) {
	return Result.try(
		async () => {
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

				const gradebookItemResult =
					await tryFindGradebookItemByCourseModuleLink({
						payload,
						req: reqWithTransaction,
						overrideAccess,
						courseModuleLinkId,
					});

				if (gradebookItemResult.ok) {
					const gradebookItem = gradebookItemResult.value;
					if (
						grade < gradebookItem.minGrade ||
						grade > gradebookItem.maxGrade
					) {
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
					req: reqWithTransaction,
					overrideAccess,
				});

				// Fetch the updated submission with depth for return value
				const updatedSubmission = await payload
					.findByID({
						collection: AssignmentSubmissions.slug,
						id,
						depth: 1,
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
}

/**
 * Lists assignment submissions with optional filtering
 */
export function tryListAssignmentSubmissions(
	args: ListAssignmentSubmissionsArgs,
) {
	return Result.try(
		async () => {
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
}

/**
 * Deletes an assignment submission
 */
export function tryDeleteAssignmentSubmission(
	args: DeleteAssignmentSubmissionArgs,
) {
	return Result.try(
		async () => {
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
}
