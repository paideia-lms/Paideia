import type { Payload, Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { InvalidArgumentError, transformError, UnknownError } from "~/utils/error";
import { tryFindGradebookByCourseId } from "./gradebook-management";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryGetNextItemSortOrder,
} from "./gradebook-item-management";

export interface CreateCourseActivityModuleLinkArgs {
	course: number;
	activityModule: number;
	section: number;
	order?: number;
	contentOrder?: number;
	settings?: CourseModuleSettingsV1;
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
 * and automatically creates a gradebook item if the module is gradeable
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
			settings,
			transactionID,
		} = args;

		const newLink = await payload.create({
			collection: CourseActivityModuleLinks.slug,
			data: {
				course,
				activityModule,
				section,
				contentOrder,
				settings: settings as unknown as { [key: string]: unknown },
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

		////////////////////////////////////////////////////
		// Create gradebook item for gradeable modules
		////////////////////////////////////////////////////

		// Get the full activity module to check its type
		const activityModuleDoc = await payload.findByID({
			collection: "activity-modules",
			id: activityModule,
			req: {
				...request,
				transactionID,
			},
		});

		const moduleType = activityModuleDoc.type;
		const gradeableTypes = ["assignment", "quiz", "discussion"] as const

		if (gradeableTypes.includes(moduleType)) {
			// Try to get the gradebook for this course
			const gradebookResult = await tryFindGradebookByCourseId(payload, course);

			if (gradebookResult.ok) {
				const gradebook = gradebookResult.value;

				// Get the next sort order for items without a category
				const nextSortOrderResult = await tryGetNextItemSortOrder(
					payload,
					gradebook.id,
					null,
				);

				const sortOrder = nextSortOrderResult.ok
					? nextSortOrderResult.value
					: 0;

				// Create the gradebook item
				const createItemResult = await tryCreateGradebookItem(
					payload,
					request,
					{
						gradebookId: gradebook.id,
						categoryId: null,
						name: activityModuleDoc.title || "Untitled Activity",
						description: activityModuleDoc.description || undefined,
						activityModuleId: newLink.id,
						maxGrade: 100, // Default max grade
						minGrade: 0,
						weight: 0, // Default weight
						extraCredit: false,
						sortOrder,
						transactionID,
					},
				);

				// If gradebook item creation fails, we should still return the link
				// but log the error (the transaction will handle rollback if needed)
				if (!createItemResult.ok) {
					console.error(
						"Failed to create gradebook item for activity module link:",
						createItemResult.error,
					);
				}
			}
		}

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
						z.number()
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
 * and automatically deletes any associated gradebook items
 */
export const tryDeleteCourseActivityModuleLink = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		linkId: number,
		transactionID?: string | number,
	) => {
		////////////////////////////////////////////////////
		// Delete associated gradebook items
		////////////////////////////////////////////////////

		// Find any gradebook items linked to this activity module link
		const gradebookItems = await payload.find({
			collection: "gradebook-items",
			where: {
				activityModule: {
					equals: linkId,
				},
			},
			pagination: false,
			req: {
				...request,
				transactionID,
			},
		});


		for (const item of gradebookItems.docs) {
			await tryDeleteGradebookItem(payload, request, item.id, transactionID);
		}

		////////////////////////////////////////////////////
		// Delete the link
		////////////////////////////////////////////////////

		const deletedLink = await payload.delete({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			req: {
				...request,
				transactionID,
			},
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
 * Updates course module settings for a specific link
 */
export const tryUpdateCourseModuleSettings = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		linkId: number,
		settings?: CourseModuleSettingsV1,
		transactionID?: string | number,
	) => {
		// Validate date logic based on module type
		if (settings?.settings.type === "assignment") {
			const { allowSubmissionsFrom, dueDate, cutoffDate } = settings.settings;

			if (allowSubmissionsFrom && dueDate) {
				if (new Date(allowSubmissionsFrom) > new Date(dueDate)) {
					throw new InvalidArgumentError(
						"Allow submissions from date must be before due date",
					);
				}
			}

			if (dueDate && cutoffDate) {
				if (new Date(dueDate) > new Date(cutoffDate)) {
					throw new InvalidArgumentError("Due date must be before cutoff date");
				}
			}

			if (allowSubmissionsFrom && cutoffDate) {
				if (new Date(allowSubmissionsFrom) > new Date(cutoffDate)) {
					throw new InvalidArgumentError(
						"Allow submissions from date must be before cutoff date",
					);
				}
			}
		}

		if (settings?.settings.type === "quiz") {
			const { openingTime, closingTime } = settings.settings;

			if (openingTime && closingTime) {
				if (new Date(openingTime) > new Date(closingTime)) {
					throw new InvalidArgumentError("Opening time must be before closing time");
				}
			}
		}

		if (settings?.settings.type === "discussion") {
			const { dueDate, cutoffDate } = settings.settings;

			if (dueDate && cutoffDate) {
				if (new Date(dueDate) > new Date(cutoffDate)) {
					throw new InvalidArgumentError("Due date must be before cutoff date");
				}
			}
		}

		const updatedLink = await payload.update({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			data: {
				settings: settings as unknown as { [key: string]: unknown },
			},
			req: {
				...request,
				transactionID,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const linkCourse = updatedLink.course;
		assertZodInternal(
			"tryUpdateCourseModuleSettings: Course is required",
			linkCourse,
			z.object({
				id: z.number(),
			}),
		);

		const linkActivityModule = updatedLink.activityModule;
		assertZodInternal(
			"tryUpdateCourseModuleSettings: Activity module is required",
			linkActivityModule,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedLink,
			course: linkCourse,
			activityModule: linkActivityModule,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update course module settings", {
			cause: error,
		}),
);

/**
 * Retrieves course module settings for a specific link
 */
export const tryGetCourseModuleSettings = Result.wrap(
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
			"tryGetCourseModuleSettings: Course is required",
			linkCourse,
			z.object({
				id: z.number(),
			}),
		);

		const linkActivityModule = link.activityModule;
		assertZodInternal(
			"tryGetCourseModuleSettings: Activity module is required",
			linkActivityModule,
			z.object({
				id: z.number(),
			}),
		);

		// Settings can be null if not configured
		const settings = link.settings as CourseModuleSettingsV1 | null;

		return {
			...link,
			course: linkCourse,
			activityModule: linkActivityModule,
			settings,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get course module settings", {
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
