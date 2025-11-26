import type { Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import type { LatestCourseModuleSettings } from "server/json";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	DevelopmentError,
	InvalidArgumentError,
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	type ActivityModuleResult,
	tryGetActivityModuleById,
} from "./activity-module-management";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryGetNextItemSortOrder,
} from "./gradebook-item-management";
import { tryGetGradebookByCourseWithDetails } from "./gradebook-management";
import {
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";

/**
 * Course data that can be included in link results
 */
type CourseLinkData = {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	status: "draft" | "published" | "archived";
	createdAt: string;
	updatedAt: string;
};

/**
 * Base type for course activity module link result with common fields
 */
type BaseCourseActivityModuleLinkResult = {
	id: number;
	course: {
		id: number;
		title: string;
		slug: string;
		description: string | null;
		status: "draft" | "published" | "archived";
		createdAt: string;
		updatedAt: string;
	};
	section: { id: number };
	contentOrder: number;
	settings: LatestCourseModuleSettings | null;
	createdAt: string;
	updatedAt: string;
};

/**
 * Page module link result
 */
type PageModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "page" }>;
};

/**
 * Whiteboard module link result
 */
type WhiteboardModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "whiteboard" }>;
};

/**
 * File module link result
 */
type FileModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "file" }>;
};

/**
 * Assignment module link result
 */
type AssignmentModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "assignment" }>;
};

/**
 * Quiz module link result
 */
type QuizModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "quiz" }>;
};

/**
 * Discussion module link result
 */
type DiscussionModuleLinkResult = BaseCourseActivityModuleLinkResult & {
	activityModule: Extract<ActivityModuleResult, { type: "discussion" }>;
};

/**
 * Discriminated union of all course activity module link result types
 */
export type CourseActivityModuleLinkResult =
	| PageModuleLinkResult
	| WhiteboardModuleLinkResult
	| FileModuleLinkResult
	| AssignmentModuleLinkResult
	| QuizModuleLinkResult
	| DiscussionModuleLinkResult;

export type CreateCourseActivityModuleLinkArgs = BaseInternalFunctionArgs & {
	course: number;
	activityModule: number;
	section: number;
	order?: number;
	contentOrder?: number;
	settings?: LatestCourseModuleSettings;
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

		const newLink = await payload
			.create({
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
			})
			.catch((error) => {
				interceptPayloadError(
					error,
					"tryCreateCourseActivityModuleLink",
					`to create course activity module link`,
					{ payload, user, req, overrideAccess },
				);
				throw error;
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
		const activityModuleDoc = await payload
			.findByID({
				collection: "activity-modules",
				id: activityModule,
				user,
				req,
				overrideAccess,
			})
			.catch((error) => {
				interceptPayloadError(
					error,
					"tryCreateCourseActivityModuleLink",
					`to get activity module by id ${activityModule}`,
					{ payload, user, req, overrideAccess },
				);
				throw error;
			});

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
 * Returns array of discriminated unions based on activity module type
 */
export const tryFindLinksByCourse = Result.wrap(
	async (args: FindLinksByCourseArgs) => {
		const { payload, courseId, overrideAccess = false, user, req } = args;
		const linksResult = await payload
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
			.then(stripDepth<2, "find">());

		// Extract course data before stripping depth
		const courseDataMap = new Map<
			number,
			{
				id: number;
				title: string;
				slug: string;
				description: string | null;
				status: "draft" | "published" | "archived";
				createdAt: string;
				updatedAt: string;
			}
		>();

		for (const link of linksResult.docs) {
			courseDataMap.set(link.id, {
				id: link.course.id,
				title: link.course.title,
				slug: link.course.slug,
				description: link.course.description ?? null,
				status: link.course.status,
				createdAt: link.course.createdAt,
				updatedAt: link.course.updatedAt,
			});
		}

		// Strip depth for other fields
		const links = await stripDepth<1, "find">()(linksResult);

		// Transform each link to discriminated union
		const results: CourseActivityModuleLinkResult[] = [];
		for (const link of links.docs) {
			const activityModuleId = link.activityModule.id;
			const courseData = courseDataMap.get(link.id);

			if (!courseData) {
				throw new DevelopmentError(
					`tryFindLinksByCourse: Course data not found for link ${link.id}`,
				);
			}

			const activityModuleResult = await tryGetActivityModuleById({
				payload,
				id: activityModuleId,
				user,
				req,
				overrideAccess,
			});

			if (!activityModuleResult.ok) {
				// Skip links with missing activity modules
				continue;
			}

			const result = await buildCourseActivityModuleLinkResult(
				{
					...link,
					course: courseData,
				},
				activityModuleResult.value,
			);
			results.push(result);
		}

		return results;
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
 * Returns array of discriminated unions based on activity module type
 */
export const tryFindLinksByActivityModule = Result.wrap(
	async (args: FindLinksByActivityModuleArgs) => {
		const {
			payload,
			activityModuleId,
			overrideAccess = false,
			user,
			req,
		} = args;

		// Get activity module once (all links share the same activity module)
		const activityModuleResult = await tryGetActivityModuleById({
			payload,
			id: activityModuleId,
			user,
			req,
			overrideAccess,
		});

		if (!activityModuleResult.ok) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${activityModuleId}' not found`,
			);
		}

		const linksResult = await payload
			.find({
				collection: CourseActivityModuleLinks.slug,
				where: {
					activityModule: {
						equals: activityModuleId,
					},
				},
				depth: 1,
				pagination: false,
				sort: "-createdAt",
				overrideAccess,
				user,
				req,
			})
			.then(stripDepth<1, "find">());

		// Extract course data before stripping depth
		const courseDataMap = new Map<
			number,
			{
				id: number;
				title: string;
				slug: string;
				description: string | null;
				status: "draft" | "published" | "archived";
				createdAt: string;
				updatedAt: string;
			}
		>();

		for (const link of linksResult.docs) {
			courseDataMap.set(link.id, {
				id: link.course.id,
				title: link.course.title,
				slug: link.course.slug,
				description: link.course.description ?? null,
				status: link.course.status,
				createdAt: link.course.createdAt,
				updatedAt: link.course.updatedAt,
			});
		}

		// Strip depth for other fields
		const links = await stripDepth<1, "find">()(linksResult);

		// Transform each link to discriminated union
		const results: CourseActivityModuleLinkResult[] = [];
		for (const link of links.docs) {
			const courseData = courseDataMap.get(link.id);
			if (!courseData) {
				throw new DevelopmentError(
					`tryFindLinksByActivityModule: Course data not found for link ${link.id}`,
				);
			}
			const result = await buildCourseActivityModuleLinkResult(
				{
					...link,
					course: courseData,
				},
				activityModuleResult.value,
			);
			results.push(result);
		}

		return results;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find links by activity module", {
			cause: error,
		}),
);

/**
 * Searches course-activity-module-links with various filters
 * Returns paginated discriminated unions based on activity module type
 */
export const trySearchCourseActivityModuleLinks = Result.wrap(
	async (args: SearchCourseActivityModuleLinksArgs) => {
		const {
			payload,
			course,
			activityModule,
			limit = 10,
			page = 1,
			overrideAccess = false,
			user,
			req,
		} = args;
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

		const links = await payload
			.find({
				collection: CourseActivityModuleLinks.slug,
				where,
				limit,
				page,
				sort: "-createdAt",
				depth: 1,
				overrideAccess,
				user,
				req,
			})
			.then(stripDepth<1, "find">());

		// Transform each link to discriminated union
		const results: CourseActivityModuleLinkResult[] = [];
		for (const link of links.docs) {
			const activityModuleRef = link.activityModule;
			const activityModuleId = activityModuleRef.id;

			const activityModuleResult = await tryGetActivityModuleById({
				payload,
				id: activityModuleId,
				user,
				req,
				overrideAccess,
			});

			if (!activityModuleResult.ok) {
				// Skip links with missing activity modules
				continue;
			}

			const result = await buildCourseActivityModuleLinkResult(
				link,
				activityModuleResult.value,
			);
			results.push(result);
		}

		return {
			docs: results,
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

/**
 * Builds a discriminated union result from link data and activity module result
 */
async function buildCourseActivityModuleLinkResult(
	link: {
		id: number;
		course: {
			id: number;
			title: string;
			slug: string;
			description: string | null;
			status: "draft" | "published" | "archived";
			createdAt: string;
			updatedAt: string;
		};
		section: number | { id: number };
		contentOrder: number;
		settings?: unknown;
		createdAt: string;
		updatedAt: string;
	},
	activityModule: ActivityModuleResult,
): Promise<CourseActivityModuleLinkResult> {
	// Extract course, preserving full object if available
	const course: CourseLinkData = link.course;

	const section =
		typeof link.section === "number" ? { id: link.section } : link.section;
	const settings = (link.settings as LatestCourseModuleSettings | null) ?? null;

	const baseResult: BaseCourseActivityModuleLinkResult = {
		id: link.id,
		course,
		section,
		contentOrder: link.contentOrder,
		settings,
		createdAt: link.createdAt,
		updatedAt: link.updatedAt,
	};

	const { type } = activityModule;

	if (type === "page") {
		return {
			...baseResult,
			activityModule,
		} satisfies PageModuleLinkResult;
	} else if (type === "whiteboard") {
		return {
			...baseResult,
			activityModule,
		} satisfies WhiteboardModuleLinkResult;
	} else if (type === "file") {
		return {
			...baseResult,
			activityModule,
		} satisfies FileModuleLinkResult;
	} else if (type === "assignment") {
		return {
			...baseResult,
			activityModule,
		} satisfies AssignmentModuleLinkResult;
	} else if (type === "quiz") {
		return {
			...baseResult,
			activityModule,
		} satisfies QuizModuleLinkResult;
	} else {
		// discussion
		return {
			...baseResult,
			activityModule,
		} satisfies DiscussionModuleLinkResult;
	}
}

export type FindCourseActivityModuleLinkByIdArgs = BaseInternalFunctionArgs & {
	linkId: number;
};

/**
 * Finds a course-activity-module-link by ID
 * Returns a discriminated union based on the activity module type
 */
export const tryFindCourseActivityModuleLinkById = Result.wrap(
	async (args: FindCourseActivityModuleLinkByIdArgs) => {
		const { payload, linkId, overrideAccess = false, user, req } = args;
		const link = await payload
			.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				depth: 1,
				overrideAccess,
				user,
				req,
			})
			.then(stripDepth<1, "findByID">());

		// Get activity module ID
		const activityModuleRef = link.activityModule;
		const activityModuleId = activityModuleRef.id;

		// Fetch activity module using tryGetActivityModuleById which returns discriminated union
		const activityModuleResult = await tryGetActivityModuleById({
			payload,
			id: activityModuleId,
			user,
			req,
			overrideAccess,
		});

		if (!activityModuleResult.ok) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${activityModuleId}' not found`,
			);
		}

		// Build discriminated union result
		return buildCourseActivityModuleLinkResult(
			link,
			activityModuleResult.value,
		);
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find course-activity-module-link by ID", {
			cause: error,
		}),
);

export type UpdateCourseModuleSettingsArgs = BaseInternalFunctionArgs & {
	linkId: number;
	settings?: LatestCourseModuleSettings;
};

/**
 * Updates course module settings for a specific link
 */
export const tryUpdateCourseModuleSettings = Result.wrap(
	async (args: UpdateCourseModuleSettingsArgs) => {
		const {
			payload,
			linkId,
			settings,
			req,
			overrideAccess = false,
			user,
		} = args;
		// Validate date logic and maxAttempts based on module type
		if (settings?.settings.type === "assignment") {
			const { allowSubmissionsFrom, dueDate, cutoffDate, maxAttempts } =
				settings.settings;

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

			if (maxAttempts !== undefined && maxAttempts < 1) {
				throw new InvalidArgumentError(
					"maxAttempts must be greater than or equal to 1",
				);
			}
		}

		if (settings?.settings.type === "quiz") {
			const { openingTime, closingTime, maxAttempts } = settings.settings;

			if (openingTime && closingTime) {
				if (new Date(openingTime) > new Date(closingTime)) {
					throw new InvalidArgumentError(
						"Opening time must be before closing time",
					);
				}
			}

			if (maxAttempts !== undefined && maxAttempts < 1) {
				throw new InvalidArgumentError(
					"maxAttempts must be greater than or equal to 1",
				);
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

		const updatedLink = await payload
			.update({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				data: {
					settings: settings as unknown as { [key: string]: unknown },
				},
				depth: 1,
				req,
				overrideAccess,
				user,
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError(
					error,
					"tryUpdateCourseModuleSettings",
					`to update course module settings for link ${linkId}`,
					{ payload, user, req, overrideAccess },
				);
				throw error;
			});

		return updatedLink;
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
 * Returns discriminated union for consistency
 */
export const tryGetCourseModuleSettings = Result.wrap(
	async (args: GetCourseModuleSettingsArgs) => {
		const { payload, linkId, overrideAccess = false, user, req } = args;
		const link = await payload
			.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				depth: 1,
				overrideAccess,
				user,
				req,
			})
			.then(stripDepth<1, "findByID">());

		// Get activity module ID
		const activityModuleRef = link.activityModule;
		const activityModuleId = activityModuleRef.id;

		// Fetch activity module using tryGetActivityModuleById which returns discriminated union
		const activityModuleResult = await tryGetActivityModuleById({
			payload,
			id: activityModuleId,
			user,
			req,
			overrideAccess,
		});

		if (!activityModuleResult.ok) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${activityModuleId}' not found`,
			);
		}

		// Build discriminated union result
		return buildCourseActivityModuleLinkResult(
			link,
			activityModuleResult.value,
		);
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get course module settings", {
			cause: error,
		}),
);

export type CheckCourseActivityModuleLinkExistsArgs =
	BaseInternalFunctionArgs & {
		courseId: number;
		activityModuleId: number;
	};

/**
 * Checks if a course-activity-module link already exists
 */
export const tryCheckCourseActivityModuleLinkExists = Result.wrap(
	async (args: CheckCourseActivityModuleLinkExistsArgs) => {
		const {
			payload,
			courseId,
			activityModuleId,
			overrideAccess = false,
			user,
			req,
		} = args;
		const links = await payload
			.count({
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
				overrideAccess,
				user,
				req,
			})
			.catch((error) => {
				interceptPayloadError(
					error,
					"tryCheckCourseActivityModuleLinkExists",
					"count course activity module link",
					args,
				);
				throw error;
			});
		return links.totalDocs > 0;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check course-activity-module link existence", {
			cause: error,
		}),
);
