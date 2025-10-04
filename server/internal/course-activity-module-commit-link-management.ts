import type { Payload } from "payload";
import { Result } from "typescript-result";

export interface CreateCourseActivityModuleCommitLinkArgs {
	course: number;
	commit: number;
}

export interface SearchCourseActivityModuleCommitLinksArgs {
	course?: number;
	commit?: number;
	limit?: number;
	page?: number;
}

/**
 * Creates a new course-activity-module-commit-link using Payload local API
 */
export const tryCreateCourseActivityModuleCommitLink = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: CreateCourseActivityModuleCommitLinkArgs,
	) => {
		const { course, commit } = args;

		const newLink = await payload.create({
			collection: "course-activity-module-commit-links",
			data: {
				course,
				commit,
			},
			req: request,
		});

		return newLink;
	},
	(error) =>
		new Error(
			`Failed to create course-activity-module-commit-link: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds course-activity-module-commit-links by course ID
 */
export const tryFindLinksByCourse = Result.wrap(
	async (payload: Payload, courseId: number, limit: number = 10) => {
		const links = await payload.find({
			collection: "course-activity-module-commit-links",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return links.docs;
	},
	(error) =>
		new Error(
			`Failed to find links by course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds course-activity-module-commit-links by commit ID
 */
export const tryFindLinksByCommit = Result.wrap(
	async (payload: Payload, commitId: number, limit: number = 10) => {
		const links = await payload.find({
			collection: "course-activity-module-commit-links",
			where: {
				commit: {
					equals: commitId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return links.docs;
	},
	(error) =>
		new Error(
			`Failed to find links by commit: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Searches course-activity-module-commit-links with various filters
 */
export const trySearchCourseActivityModuleCommitLinks = Result.wrap(
	async (
		payload: Payload,
		args: SearchCourseActivityModuleCommitLinksArgs = {},
	) => {
		const { course, commit, limit = 10, page = 1 } = args;

		const where: any = {};

		if (course) {
			where.course = {
				equals: course,
			};
		}

		if (commit) {
			where.commit = {
				equals: commit,
			};
		}

		const links = await payload.find({
			collection: "course-activity-module-commit-links",
			where,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: links.docs,
			totalDocs: links.totalDocs,
			totalPages: links.totalPages,
			page: links.page,
			limit: links.limit,
			hasNextPage: links.hasNextPage,
			hasPrevPage: links.hasPrevPage,
		};
	},
	(error) =>
		new Error(
			`Failed to search course-activity-module-commit-links: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a course-activity-module-commit-link by ID
 */
export const tryDeleteCourseActivityModuleCommitLink = Result.wrap(
	async (payload: Payload, request: Request, linkId: number) => {
		const deletedLink = await payload.delete({
			collection: "course-activity-module-commit-links",
			id: linkId,
			req: request,
		});

		return deletedLink;
	},
	(error) =>
		new Error(
			`Failed to delete course-activity-module-commit-link: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a course-activity-module-commit-link by ID
 */
export const tryFindCourseActivityModuleCommitLinkById = Result.wrap(
	async (payload: Payload, linkId: number) => {
		const link = await payload.findByID({
			collection: "course-activity-module-commit-links",
			id: linkId,
		});

		if (!link) {
			throw new Error(
				`Course-activity-module-commit-link with ID ${linkId} not found`,
			);
		}

		return link;
	},
	(error) =>
		new Error(
			`Failed to find course-activity-module-commit-link by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Checks if a course-commit link already exists
 */
export const tryCheckCourseCommitLinkExists = Result.wrap(
	async (payload: Payload, courseId: number, commitId: number) => {
		const links = await payload.find({
			collection: "course-activity-module-commit-links",
			where: {
				and: [
					{
						course: {
							equals: courseId,
						},
					},
					{
						commit: {
							equals: commitId,
						},
					},
				],
			},
			limit: 1,
		});

		return links.docs.length > 0;
	},
	(error) =>
		new Error(
			`Failed to check course-commit link existence: ${error instanceof Error ? error.message : String(error)}`,
		),
);
