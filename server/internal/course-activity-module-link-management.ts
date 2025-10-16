import type { Payload, Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { TransactionIdNotFoundError, transformError, UnknownError } from "~/utils/error";

export interface CreateCourseActivityModuleLinkArgs {
	course: number;
	activityModule: number;
	transactionID?: string | number;
}

export interface SearchCourseActivityModuleLinksArgs {
	course?: number;
	activityModule?: number;
	limit?: number;
	page?: number;
}

/**
 * Creates a new course-activity-module-link using Payload local API
 */
export const tryCreateCourseActivityModuleLink = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: CreateCourseActivityModuleLinkArgs,
	) => {
		const { course, activityModule, transactionID } = args;

		const newLink = await payload.create({
			collection: CourseActivityModuleLinks.slug,
			data: {
				course,
				activityModule,
			},
			req: {
				...request,
				transactionID,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const newLinkCourse = newLink.course;
		assertZod(
			newLinkCourse,
			z.object({
				id: z.number(),
			}),
		);

		const newLinkActivityModule = newLink.activityModule;
		assertZod(
			newLinkActivityModule,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...newLink,
			course: newLinkCourse,
			activityModule: newLinkActivityModule,
		};
	},
	(error) =>
		new Error(
			`Failed to create course-activity-module-link: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds course-activity-module-links by course ID
 */
export const tryFindLinksByCourse = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const links = await payload.find({
			collection: CourseActivityModuleLinks.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			depth: 2,
			pagination: false,
			sort: "-createdAt",
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		return links.docs.map((link) => {
			const linkCourse = link.course;
			assertZod(
				linkCourse,
				z.object({
					id: z.number(),
				}),
			);

			const linkActivityModule = link.activityModule;
			assertZod(
				linkActivityModule,
				z.object({
					id: z.number(),
				}),
			);

			const moduleCreatedBy = linkActivityModule.createdBy;
			assertZod(moduleCreatedBy, z.object({
				id: z.number(),
			}));

			const moduleCreatedByAvatar = moduleCreatedBy.avatar;
			assertZod(moduleCreatedByAvatar, z.object({
				id: z.number(),
			}).nullish());

			return {
				...link,
				course: linkCourse,
				activityModule: {
					...linkActivityModule,
					createdBy: {
						...moduleCreatedBy,
						avatar: moduleCreatedByAvatar,
					},
				},
			};
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find links by course", {
			cause: error,
		}),
);

/**
 * Finds course-activity-module-links by activity module ID
 */
export const tryFindLinksByActivityModule = Result.wrap(
	async (payload: Payload, activityModuleId: number) => {
		const links = await payload.find({
			collection: CourseActivityModuleLinks.slug,
			where: {
				activityModule: {
					equals: activityModuleId,
				},
			},
			pagination: false,
			sort: "-createdAt",
		});

		return links.docs;
	},
	(error) =>
		new Error(
			`Failed to find links by activity module: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Searches course-activity-module-links with various filters
 */
export const trySearchCourseActivityModuleLinks = Result.wrap(
	async (payload: Payload, args: SearchCourseActivityModuleLinksArgs = {}) => {
		const { course, activityModule, limit = 10, page = 1 } = args;

		const where: Where = {};

		if (course) {
			where.course = {
				equals: course,
			};
		}

		if (activityModule) {
			where.activityModule = {
				equals: activityModule,
			};
		}

		const links = await payload.find({
			collection: CourseActivityModuleLinks.slug,
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
			`Failed to search course-activity-module-links: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a course-activity-module-link by ID
 */
export const tryDeleteCourseActivityModuleLink = Result.wrap(
	async (payload: Payload, request: Request, linkId: number) => {
		const deletedLink = await payload.delete({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			req: request,
		});

		return deletedLink;
	},
	(error) =>
		new Error(
			`Failed to delete course-activity-module-link: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a course-activity-module-link by ID
 */
export const tryFindCourseActivityModuleLinkById = Result.wrap(
	async (payload: Payload, linkId: number) => {
		const link = await payload.findByID({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const linkCourse = link.course;
		assertZod(
			linkCourse,
			z.object({
				id: z.number(),
			}),
		);

		const linkActivityModule = link.activityModule;
		assertZod(
			linkActivityModule,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...link,
			course: linkCourse,
			activityModule: linkActivityModule,
		};
	},
	(error) =>
		new Error(
			`Failed to find course-activity-module-link by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Checks if a course-activity-module link already exists
 */
export const tryCheckCourseActivityModuleLinkExists = Result.wrap(
	async (payload: Payload, courseId: number, activityModuleId: number) => {
		const links = await payload.find({
			collection: CourseActivityModuleLinks.slug,
			where: {
				and: [
					{
						course: {
							equals: courseId,
						},
					},
					{
						activityModule: {
							equals: activityModuleId,
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
			`Failed to check course-activity-module link existence: ${error instanceof Error ? error.message : String(error)}`,
		),
);
