import type { Payload, Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";

export interface CreateCourseActivityModuleLinkArgs {
	course: number;
	activityModule: number;
	section: number;
	order?: number;
	contentOrder?: number;
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
		const {
			course,
			activityModule,
			section,
			contentOrder = 0,
			transactionID,
		} = args;

		const newLink = await payload.create({
			collection: CourseActivityModuleLinks.slug,
			data: {
				course,
				activityModule,
				section,
				contentOrder,
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
		assertZodInternal(
			"tryCreateCourseActivityModuleLink: Course is required",
			newLinkCourse,
			z.object({ id: z.number() }),
		);

		const newLinkActivityModule = newLink.activityModule;
		assertZodInternal(
			"tryCreateCourseActivityModuleLink: Activity module is required",
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
		transformError(error) ??
		new UnknownError("Failed to create course-activity-module-link", {
			cause: error,
		}),
);

/**
 * Finds course-activity-module-links by course ID
 */
export const tryFindLinksByCourse = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const links = await payload
			.find({
				collection: CourseActivityModuleLinks.slug,
				where: {
					course: {
						equals: courseId,
					},
				},
				depth: 2,
				pagination: false,
				sort: "-createdAt",
			})
			.then((result) => {
				return result.docs.map((link) => {
					const linkCourse = link.course;
					assertZodInternal(
						"tryFindLinksByCourse: Course is required",
						linkCourse,
						z.object({ id: z.number() }),
					);

					const linkActivityModule = link.activityModule;
					assertZodInternal(
						"tryFindLinksByCourse: Activity module is required",
						linkActivityModule,
						z.object({ id: z.number() }),
					);

					const moduleCreatedBy = linkActivityModule.createdBy;
					assertZodInternal(
						"tryFindLinksByCourse: Module created by is required",
						moduleCreatedBy,
						z.object({ id: z.number() }),
					);

					const moduleCreatedByAvatar = moduleCreatedBy.avatar;
					assertZodInternal(
						"tryFindLinksByCourse: Module created by avatar is required",
						moduleCreatedByAvatar,
						z
							.object({
								id: z.number(),
							})
							.nullish(),
					);

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
			});
		return links;
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
		const links = await payload
			.find({
				collection: CourseActivityModuleLinks.slug,
				where: {
					activityModule: {
						equals: activityModuleId,
					},
				},
				pagination: false,
				sort: "-createdAt",
			})
			.then((result) => {
				return result.docs.map((doc) => {
					const course = doc.course;
					assertZodInternal(
						"tryFindLinksByActivityModule: Course is required",
						course,
						z.object({ id: z.number() }),
					);
					const activityModule = doc.activityModule;
					assertZodInternal(
						"tryFindLinksByActivityModule: Activity module is required",
						activityModule,
						z.object({ id: z.number() }),
					);
					assertZodInternal(
						"tryFindLinksByActivityModule: Activity module is required",
						activityModule,
						z.object({ id: z.number() }),
					);
					const section = doc.section;
					assertZodInternal(
						"tryFindLinksByActivityModule: Section is required",
						section,
						z.object({ id: z.number() }),
					);
					return {
						...doc,
						course,
						activityModule,
						section,
					};
				});
			});

		return links;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find links by activity module", {
			cause: error,
		}),
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
		transformError(error) ??
		new UnknownError("Failed to search course-activity-module-links", {
			cause: error,
		}),
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
		transformError(error) ??
		new UnknownError("Failed to delete course-activity-module-link", {
			cause: error,
		}),
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
		assertZodInternal(
			"tryFindCourseActivityModuleLinkById: Course is required",
			linkCourse,
			z.object({
				id: z.number(),
			}),
		);

		const linkActivityModule = link.activityModule;
		assertZodInternal(
			"tryFindCourseActivityModuleLinkById: Activity module is required",
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
		transformError(error) ??
		new UnknownError("Failed to find course-activity-module-link by ID", {
			cause: error,
		}),
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
		transformError(error) ??
		new UnknownError("Failed to check course-activity-module link existence", {
			cause: error,
		}),
);
