import { Assignments } from "../collections/assignments";
import { AssignmentSubmissions } from "../collections/assignment-submissions";
import { Result } from "typescript-result";
import { transformError } from "../errors";
import { InvalidArgumentError, UnknownError } from "@paideia/shared";
import { stripDepth, type BaseInternalFunctionArgs } from "@paideia/shared";
import { handleTransactionId } from "@paideia/shared";
import type { Where } from "payload";

export interface CreateAssignmentArgs extends BaseInternalFunctionArgs {
	data: {
		title: string;
		description?: string;
		instructions?: string;
		courseId: number;
		sectionId: number;
		dueDate?: string;
		maxAttempts?: number;
		maxGrade?: number;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
		maxFileSize?: number;
		maxFiles?: number;
		createdBy: number;
	};
}

export interface UpdateAssignmentArgs extends BaseInternalFunctionArgs {
	assignmentId: number;
	data: {
		title?: string;
		description?: string;
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		maxGrade?: number;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
		maxFileSize?: number;
		maxFiles?: number;
	};
}

export interface FindAssignmentByIdArgs extends BaseInternalFunctionArgs {
	assignmentId: number;
}

export interface ListAssignmentsByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	sectionId?: number;
	limit?: number;
	page?: number;
}

export interface DeleteAssignmentArgs extends BaseInternalFunctionArgs {
	assignmentId: number;
}

export interface SubmitAssignmentArgs extends BaseInternalFunctionArgs {
	assignmentId: number;
	studentId: number;
	content?: string;
	attemptNumber?: number;
}

export interface GradeSubmissionArgs extends BaseInternalFunctionArgs {
	submissionId: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
}

export interface ListSubmissionsArgs extends BaseInternalFunctionArgs {
	assignmentId?: number;
	studentId?: number;
	status?: "draft" | "submitted" | "graded" | "returned";
	limit?: number;
	page?: number;
}

export interface FindSubmissionByIdArgs extends BaseInternalFunctionArgs {
	submissionId: number;
}

export interface DeleteSubmissionArgs extends BaseInternalFunctionArgs {
	submissionId: number;
}

export function tryCreateAssignment(args: CreateAssignmentArgs) {
	return Result.try(
		async () => {
			const { payload, data, req, overrideAccess = false } = args;

			if (!data.title || data.title.trim().length === 0) {
				throw new InvalidArgumentError("Assignment title is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const assignment = await payload
					.create({
						collection: Assignments.slug,
						data: {
							title: data.title.trim(),
							description: data.description,
							instructions: data.instructions,
							course: data.courseId,
							section: data.sectionId,
							dueDate: data.dueDate,
							maxAttempts: data.maxAttempts ?? 1,
							maxGrade: data.maxGrade ?? 100,
							requireTextSubmission: data.requireTextSubmission ?? true,
							requireFileSubmission: data.requireFileSubmission ?? false,
							maxFileSize: data.maxFileSize ?? 10,
							maxFiles: data.maxFiles ?? 1,
							createdBy: data.createdBy,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return assignment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create assignment", { cause: error }),
	);
}

export function tryUpdateAssignment(args: UpdateAssignmentArgs) {
	return Result.try(
		async () => {
			const { payload, assignmentId, data, req, overrideAccess = false } = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const updated = await payload
					.update({
						collection: Assignments.slug,
						id: assignmentId,
						data: {
							...(data.title !== undefined ? { title: data.title.trim() } : {}),
							...(data.description !== undefined ? { description: data.description } : {}),
							...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
							...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
							...(data.maxAttempts !== undefined ? { maxAttempts: data.maxAttempts } : {}),
							...(data.maxGrade !== undefined ? { maxGrade: data.maxGrade } : {}),
							...(data.requireTextSubmission !== undefined ? { requireTextSubmission: data.requireTextSubmission } : {}),
							...(data.requireFileSubmission !== undefined ? { requireFileSubmission: data.requireFileSubmission } : {}),
							...(data.maxFileSize !== undefined ? { maxFileSize: data.maxFileSize } : {}),
							...(data.maxFiles !== undefined ? { maxFiles: data.maxFiles } : {}),
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updated;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update assignment", { cause: error }),
	);
}

export function tryFindAssignmentById(args: FindAssignmentByIdArgs) {
	return Result.try(
		async () => {
			const { payload, assignmentId, req, overrideAccess = false } = args;

			const assignment = await payload
				.findByID({
					collection: Assignments.slug,
					id: assignmentId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return assignment;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find assignment", { cause: error }),
	);
}

export function tryListAssignmentsByCourse(args: ListAssignmentsByCourseArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, sectionId, limit = 10, page = 1, req, overrideAccess = false } = args;

			const conditions: Where[] = [
				{ course: { equals: courseId } },
			];

			if (sectionId) {
				conditions.push({ section: { equals: sectionId } });
			}

			const result = await payload.find({
				collection: Assignments.slug,
				where: { and: conditions },
				limit,
				page,
				sort: "-createdAt",
				req,
				overrideAccess,
			});

			return {
				docs: result.docs,
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
			new UnknownError("Failed to list assignments", { cause: error }),
	);
}

export function tryDeleteAssignment(args: DeleteAssignmentArgs) {
	return Result.try(
		async () => {
			const { payload, assignmentId, req, overrideAccess = false } = args;

			const deleted = await payload.delete({
				collection: Assignments.slug,
				id: assignmentId,
				req,
				overrideAccess,
			});

			return deleted;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete assignment", { cause: error }),
	);
}

export function trySubmitAssignment(args: SubmitAssignmentArgs) {
	return Result.try(
		async () => {
			const { payload, assignmentId, studentId, content, attemptNumber = 1, req, overrideAccess = false } = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const assignment = await payload
					.findByID({
						collection: Assignments.slug,
						id: assignmentId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">());

				if (assignment.maxAttempts && attemptNumber > assignment.maxAttempts) {
					throw new InvalidArgumentError(
						`Maximum attempts (${assignment.maxAttempts}) exceeded`,
					);
				}

				const isLate = assignment.dueDate
					? new Date() > new Date(assignment.dueDate)
					: false;

				const submission = await payload
					.create({
						collection: AssignmentSubmissions.slug,
						data: {
							assignment: assignmentId,
							student: studentId,
							attemptNumber,
							status: "submitted",
							submittedAt: new Date().toISOString(),
							content,
							isLate,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return submission;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to submit assignment", { cause: error }),
	);
}

export function tryGradeSubmission(args: GradeSubmissionArgs) {
	return Result.try(
		async () => {
			const { payload, submissionId, grade, feedback, gradedBy, req, overrideAccess = false } = args;

			if (grade < 0) {
				throw new InvalidArgumentError("Grade cannot be negative");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const current = await payload
					.findByID({
						collection: AssignmentSubmissions.slug,
						id: submissionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 1,
					})
					.then(stripDepth<1, "findByID">());

				if (current.status !== "submitted") {
					throw new InvalidArgumentError("Only submitted assignments can be graded");
				}

				const updated = await payload
					.update({
						collection: AssignmentSubmissions.slug,
						id: submissionId,
						data: {
							grade,
							feedback,
							gradedBy,
							gradedAt: new Date().toISOString(),
							status: "graded",
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updated;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to grade submission", { cause: error }),
	);
}

export function tryListSubmissions(args: ListSubmissionsArgs) {
	return Result.try(
		async () => {
			const { payload, assignmentId, studentId, status, limit = 10, page = 1, req, overrideAccess = false } = args;

			const conditions: Where[] = [];
			if (assignmentId) conditions.push({ assignment: { equals: assignmentId } });
			if (studentId) conditions.push({ student: { equals: studentId } });
			if (status) conditions.push({ status: { equals: status } });

			const result = await payload.find({
				collection: AssignmentSubmissions.slug,
				where: conditions.length > 0 ? { and: conditions } : {},
				limit,
				page,
				sort: "-createdAt",
				depth: 1,
				req,
				overrideAccess,
			});

			return {
				docs: result.docs,
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
			new UnknownError("Failed to list submissions", { cause: error }),
	);
}

export function tryFindSubmissionById(args: FindSubmissionByIdArgs) {
	return Result.try(
		async () => {
			const { payload, submissionId, req, overrideAccess = false } = args;

			const submission = await payload
				.findByID({
					collection: AssignmentSubmissions.slug,
					id: submissionId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return submission;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find submission", { cause: error }),
	);
}

export function tryDeleteSubmission(args: DeleteSubmissionArgs) {
	return Result.try(
		async () => {
			const { payload, submissionId, req, overrideAccess = false } = args;

			const deleted = await payload.delete({
				collection: AssignmentSubmissions.slug,
				id: submissionId,
				req,
				overrideAccess,
			});

			return deleted;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete submission", { cause: error }),
	);
}
