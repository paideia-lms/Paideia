import { Data, type Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryGetNextItemSortOrder,
} from "./gradebook-item-management";
import { tryGetGradebookByCourseWithDetails } from "./gradebook-management";
import { interceptPayloadError, type BaseInternalFunctionArgs } from "./utils/internal-function-utils";



export type CreateCourseActivityModuleLinkArgs = BaseInternalFunctionArgs & {
	course: number;
	activityModule: number;
	section: number;
	order?: number;
	contentOrder?: number;
	settings?: CourseModuleSettingsV1;
};

export type SearchCourseActivityModuleLinksArgs = BaseInternalFunctionArgs & {
	course?: number;
	activityModule?: number;
	limit?: number;
	page?: number;
};

/**
 * Creates a new course-activity-module-link using Payload local API
 * and automatically creates a gradebook item if the module is gradeable
 */
export const tryCreateCourseActivityModuleLink = Result.wrap(
	async (args: CreateCourseActivityModuleLinkArgs) => {
		const {
			payload,
			course,
			activityModule,
			section,
			contentOrder = 0,
			settings,
			req,
			overrideAccess = false,
			user,
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
			req,
			overrideAccess,
			user,
		}).catch((error) => {
			interceptPayloadError(error, "tryCreateCourseActivityModuleLink", `to create course activity module link`, { payload, user, req, overrideAccess });
			throw error
		})



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
			user,
			req,
			overrideAccess,
		}).catch((error) => {
			interceptPayloadError(error, "tryCreateCourseActivityModuleLink", `to get activity module by id ${activityModule}`, { payload, user, req, overrideAccess });
			throw error
		})

		const moduleType = activityModuleDoc.type;
		const gradeableTypes = ["assignment", "quiz", "discussion"] as const;

		if (gradeableTypes.includes(moduleType)) {
			// Try to get the gradebook for this course
			const gradebookResult = await tryGetGradebookByCourseWithDetails({
				payload,
				courseId: course,
				user,
				req,
				overrideAccess,
			});

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
				const createItemResult = await tryCreateGradebookItem({
					payload,
					courseId: course,
					categoryId: null,
					name: activityModuleDoc.title || "Untitled Activity",
					description: activityModuleDoc.description || undefined,
					activityModuleId: newLink.id,
					maxGrade: 100, // Default max grade
					minGrade: 0,
					weight: null, // Auto weighted by default
					extraCredit: false,
					sortOrder,
					user,
					req,
					overrideAccess,
				});

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

export type FindLinksByCourseArgs = BaseInternalFunctionArgs & {
	courseId: number;
};

/**
 * Finds course-activity-module-links by course ID
 */
export const tryFindLinksByCourse = Result.wrap(
	async (args: FindLinksByCourseArgs) => {
		const { payload, courseId, overrideAccess = false, user, req } = args;
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
				overrideAccess,
				user,
				req,
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
						z.number().nullish(),
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

export type FindLinksByActivityModuleArgs = BaseInternalFunctionArgs & {
	activityModuleId: number;
};

/**
 * Finds course-activity-module-links by activity module ID
 */
export const tryFindLinksByActivityModule = Result.wrap(
	async (args: FindLinksByActivityModuleArgs) => {
		const { payload, activityModuleId, overrideAccess = false, user, req } = args;
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
				overrideAccess,
				user,
				req,
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
	async (args: SearchCourseActivityModuleLinksArgs) => {
		const { payload, course, activityModule, limit = 10, page = 1, overrideAccess = false, user, req } = args;
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
			overrideAccess,
			user,
			req,
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

export type DeleteCourseActivityModuleLinkArgs = BaseInternalFunctionArgs & {
	linkId: number;
};

/**
 * Deletes a course-activity-module-link by ID
 * and automatically deletes any associated gradebook items
 */
export const tryDeleteCourseActivityModuleLink = Result.wrap(
	async (args: DeleteCourseActivityModuleLinkArgs) => {
		const { payload, linkId, req, overrideAccess = false, user } = args;
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
			req,
			overrideAccess,
			user,
		});

		for (const item of gradebookItems.docs) {
			const deleteResult = await tryDeleteGradebookItem({
				payload,
				itemId: item.id,
				req,
				overrideAccess,
				user,
			});

			if (!deleteResult.ok) {
				throw deleteResult.error;
			}
		}

		////////////////////////////////////////////////////
		// Delete the link
		////////////////////////////////////////////////////

		const deletedLink = await payload.delete({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			req,
		});

		return deletedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete course-activity-module-link", {
			cause: error,
		}),
);

export type FindCourseActivityModuleLinkByIdArgs = BaseInternalFunctionArgs & {
	linkId: number;
};

/**
 * Finds a course-activity-module-link by ID
 */
export const tryFindCourseActivityModuleLinkById = Result.wrap(
	async (args: FindCourseActivityModuleLinkByIdArgs) => {
		const { payload, linkId, overrideAccess = false, user, req } = args;
		const link = await payload.findByID({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			overrideAccess,
			user,
			req,
		})

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

export type UpdateCourseModuleSettingsArgs = BaseInternalFunctionArgs & {
	linkId: number;
	settings?: CourseModuleSettingsV1;
};

/**
 * Updates course module settings for a specific link
 */
export const tryUpdateCourseModuleSettings = Result.wrap(
	async (args: UpdateCourseModuleSettingsArgs) => {
		const { payload, linkId, settings, req, overrideAccess = false, user } = args;
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
					throw new InvalidArgumentError(
						"Opening time must be before closing time",
					);
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
			req,
			overrideAccess,
			user,
		}).catch((error) => {
			interceptPayloadError(error, "tryUpdateCourseModuleSettings", `to update course module settings for link ${linkId}`, { payload, user, req, overrideAccess });
			throw error
		})

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

export type GetCourseModuleSettingsArgs = BaseInternalFunctionArgs & {
	linkId: number;
};

/**
 * Retrieves course module settings for a specific link
 */
export const tryGetCourseModuleSettings = Result.wrap(
	async (args: GetCourseModuleSettingsArgs) => {
		const { payload, linkId, overrideAccess = false, user, req } = args;
		const link = await payload.findByID({
			collection: CourseActivityModuleLinks.slug,
			id: linkId,
			overrideAccess,
			user,
			req,
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

export type CheckCourseActivityModuleLinkExistsArgs = BaseInternalFunctionArgs & {
	courseId: number;
	activityModuleId: number;
};

/**
 * Checks if a course-activity-module link already exists
 */
export const tryCheckCourseActivityModuleLinkExists = Result.wrap(
	async (args: CheckCourseActivityModuleLinkExistsArgs) => {
		const { payload, courseId, activityModuleId, overrideAccess = false, user, req } = args;
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
			overrideAccess,
			user,
			req,
		});

		return links.docs.length > 0;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check course-activity-module link existence", {
			cause: error,
		}),
);
