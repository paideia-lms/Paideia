import type { Where } from "payload";
import { CourseActivityModuleLinks } from "server/collections/course-activity-module-links";
import type {
	LatestAssignmentSettings,
	LatestCourseModuleSettings,
	LatestDiscussionSettings,
	LatestFileSettings,
	LatestPageSettings,
	LatestQuizSettings,
	LatestWhiteboardSettings,
} from "server/json";
import { Result } from "typescript-result";
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
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";

/**
 * Course data that can be included in link results
 */
interface CourseLinkData {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	status: "draft" | "published" | "archived";
	createdAt: string;
	updatedAt: string;
}

/**
 * Base type for course activity module link result with common fields
 */
interface BaseCourseActivityModuleLinkResult {
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
	createdAt: string;
	updatedAt: string;
}

/**
 * Page module link result
 */
interface PageModuleLinkResult extends BaseCourseActivityModuleLinkResult {
	type: "page";
	activityModule: Extract<ActivityModuleResult, { type: "page" }>;
	settings: LatestPageSettings | null;
}

/**
 * Whiteboard module link result
 */
interface WhiteboardModuleLinkResult
	extends BaseCourseActivityModuleLinkResult {
	type: "whiteboard";
	activityModule: Extract<ActivityModuleResult, { type: "whiteboard" }>;
	settings: LatestWhiteboardSettings | null;
}

/**
 * File module link result
 */
interface FileModuleLinkResult extends BaseCourseActivityModuleLinkResult {
	type: "file";
	activityModule: Extract<ActivityModuleResult, { type: "file" }>;
	settings: LatestFileSettings | null;
}

/**
 * Assignment module link result
 */
interface AssignmentModuleLinkResult
	extends BaseCourseActivityModuleLinkResult {
	type: "assignment";
	activityModule: Extract<ActivityModuleResult, { type: "assignment" }>;
	settings: LatestAssignmentSettings | null;
}

/**
 * Quiz module link result
 */
interface QuizModuleLinkResult extends BaseCourseActivityModuleLinkResult {
	type: "quiz";
	activityModule: Extract<ActivityModuleResult, { type: "quiz" }>;
	settings: LatestQuizSettings | null;
}

/**
 * Discussion module link result
 */
interface DiscussionModuleLinkResult
	extends BaseCourseActivityModuleLinkResult {
	type: "discussion";
	activityModule: Extract<ActivityModuleResult, { type: "discussion" }>;
	settings: LatestDiscussionSettings | null;
}

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

export interface CreateCourseActivityModuleLinkArgs
	extends BaseInternalFunctionArgs {
	course: number;
	activityModule: number;
	section: number;
	order?: number;
	contentOrder?: number;
	settings?: LatestCourseModuleSettings;
}

export interface SearchCourseActivityModuleLinksArgs
	extends BaseInternalFunctionArgs {
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
		} = args;

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
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
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<1, "create">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: `tryCreateCourseActivityModuleLink - to create course activity module link for activity module ${activityModule}`,
						args: { payload, req: reqWithTransaction, overrideAccess },
					});
					throw error;
				});

			const newLinkCourse = newLink.course;
			const newLinkActivityModule = newLink.activityModule;

			////////////////////////////////////////////////////
			// Create gradebook item for gradeable modules
			////////////////////////////////////////////////////

			// Get the full activity module to check its type
			const activityModuleDoc = await payload
				.findByID({
					collection: "activity-modules",
					id: activityModule,
					depth: 1,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: `tryCreateCourseActivityModuleLink - to get activity module by id ${activityModule}`,
						args: { payload, req: reqWithTransaction, overrideAccess },
					});
					throw error;
				});

			const moduleType = activityModuleDoc.type;
			const gradeableTypes = ["assignment", "quiz", "discussion"] as const;

			// Early return if module is not gradeable
			if (!gradeableTypes.includes(moduleType)) {
				return {
					...newLink,
					course: newLinkCourse,
					activityModule: newLinkActivityModule,
				};
			}

			// Try to get the gradebook for this course
			const gradebookResult = await tryGetGradebookByCourseWithDetails({
				payload,
				courseId: course,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Early return if gradebook doesn't exist
			if (!gradebookResult.ok) {
				return {
					...newLink,
					course: newLinkCourse,
					activityModule: newLinkActivityModule,
				};
			}

			const gradebook = gradebookResult.value;

			// Get the next sort order for items without a category
			const nextSortOrderResult = await tryGetNextItemSortOrder({
				payload,
				gradebookId: gradebook.id,
				categoryId: null,
				req: reqWithTransaction,
				overrideAccess,
			});

			const sortOrder = nextSortOrderResult.ok ? nextSortOrderResult.value : 0;

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
				req: reqWithTransaction,
				overrideAccess,
			});

			// ! if the grade item cannot be created, we should abort the whole transaction
			if (!createItemResult.ok) {
				throw createItemResult.error;
			}

			return {
				...newLink,
				course: newLinkCourse,
				activityModule: newLinkActivityModule,
			};
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create course-activity-module-link", {
			cause: error,
		}),
);

export interface FindLinksByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

/**
 * Finds course-activity-module-links by course ID
 * Returns array of discriminated unions based on activity module type
 */
export const tryFindLinksByCourse = Result.wrap(
	async (args: FindLinksByCourseArgs) => {
		const { payload, courseId, overrideAccess = false, req } = args;
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
				req,
				context: req?.context,
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

		// Transform each link to discriminated union
		const results: CourseActivityModuleLinkResult[] = [];
		for (const link of linksResult.docs) {
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

export interface FindLinksByActivityModuleArgs
	extends BaseInternalFunctionArgs {
	activityModuleId: number;
}

/**
 * Finds course-activity-module-links by activity module ID
 * Returns array of discriminated unions based on activity module type
 */
export const tryFindLinksByActivityModule = Result.wrap(
	async (args: FindLinksByActivityModuleArgs) => {
		const { payload, activityModuleId, overrideAccess = false, req } = args;

		// Get activity module once (all links share the same activity module)
		const activityModuleResult = await tryGetActivityModuleById({
			payload,
			id: activityModuleId,
			req,
			overrideAccess,
		}).getOrThrow();

		const links = await payload
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

		for (const link of links.docs) {
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
				activityModuleResult,
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

export interface DeleteCourseActivityModuleLinkArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
}

/**
 * Deletes a course-activity-module-link by ID
 * and automatically deletes any associated gradebook items
 */
export const tryDeleteCourseActivityModuleLink = Result.wrap(
	async (args: DeleteCourseActivityModuleLinkArgs) => {
		const { payload, linkId, req, overrideAccess = false } = args;
		////////////////////////////////////////////////////
		// Delete associated gradebook items
		////////////////////////////////////////////////////

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Find any gradebook items linked to this activity module link
			const gradebookItems = await payload
				.find({
					collection: "gradebook-items",
					where: {
						activityModule: {
							equals: linkId,
						},
					},
					depth: 0,
					pagination: false,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<0, "find">());

			const deletionResults = await Promise.all(
				gradebookItems.docs.map((item) =>
					tryDeleteGradebookItem({
						payload,
						itemId: item.id,
						req: reqWithTransaction,
						overrideAccess,
					}),
				),
			);

			for (const deleteResult of deletionResults) {
				if (!deleteResult.ok) {
					throw deleteResult.error;
				}
			}

			////////////////////////////////////////////////////
			// Delete the link
			////////////////////////////////////////////////////

			const deletedLink = await payload
				.delete({
					collection: CourseActivityModuleLinks.slug,
					id: linkId,
					depth: 0,
					req: reqWithTransaction,
					overrideAccess,
				})
				.then(stripDepth<0, "delete">());

			return deletedLink;
		});
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
) {
	// Extract course, preserving full object if available
	const course: CourseLinkData = link.course;

	const section =
		typeof link.section === "number" ? { id: link.section } : link.section;
	const settings = (link.settings as LatestCourseModuleSettings | null) ?? null;

	// console.log(settings);

	const baseResult: BaseCourseActivityModuleLinkResult = {
		id: link.id,
		course,
		section,
		contentOrder: link.contentOrder,
		createdAt: link.createdAt,
		updatedAt: link.updatedAt,
	};

	const { type } = activityModule;

	if (type === "page") {
		return {
			...baseResult,
			type: "page",
			activityModule,
			settings: settings?.settings as LatestPageSettings | null,
		} satisfies PageModuleLinkResult;
	} else if (type === "whiteboard") {
		return {
			...baseResult,
			type: "whiteboard",
			activityModule,
			settings: settings?.settings as LatestWhiteboardSettings | null,
		} satisfies WhiteboardModuleLinkResult;
	} else if (type === "file") {
		return {
			...baseResult,
			type: "file",
			activityModule,
			settings: settings?.settings as LatestFileSettings | null,
		} satisfies FileModuleLinkResult;
	} else if (type === "assignment") {
		return {
			...baseResult,
			type: "assignment",
			activityModule,
			settings: settings?.settings as LatestAssignmentSettings | null,
		} satisfies AssignmentModuleLinkResult;
	} else if (type === "quiz") {
		return {
			...baseResult,
			type: "quiz",
			activityModule,
			settings: settings?.settings as LatestQuizSettings | null,
		} satisfies QuizModuleLinkResult;
	} else {
		// discussion
		return {
			...baseResult,
			type: "discussion",
			activityModule,
			settings: settings?.settings as LatestDiscussionSettings | null,
		} satisfies DiscussionModuleLinkResult;
	}
}

export interface FindCourseActivityModuleLinkByIdArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
}

/**
 * Finds a course-activity-module-link by ID
 * Returns a discriminated union based on the activity module type
 */
export const tryFindCourseActivityModuleLinkById = Result.wrap(
	async (args: FindCourseActivityModuleLinkByIdArgs) => {
		const { payload, linkId, overrideAccess = false, req } = args;
		const link = await payload
			.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				depth: 1,
				overrideAccess,
				req,
				context: req?.context,
			})
			.then(stripDepth<1, "findByID">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: `tryFindCourseActivityModuleLinkById - to find course activity module link by id '${linkId}'`,
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		// Get activity module ID
		const activityModuleRef = link.activityModule;
		const activityModuleId = activityModuleRef.id;

		// Fetch activity module using tryGetActivityModuleById which returns discriminated union
		const activityModuleResult = await tryGetActivityModuleById({
			payload,
			id: activityModuleId,
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

export interface UpdatePageModuleSettingsArgs extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
}

/**
 * Updates page module settings for a specific link
 */
export const tryUpdatePageModuleSettings = Result.wrap(
	async (args: UpdatePageModuleSettingsArgs) => {
		const { payload, linkId, name, req, overrideAccess = false } = args;

		// Verify link exists and is a page module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "page") {
			throw new InvalidArgumentError(
				`Cannot update page settings for a ${link.activityModule.type} module`,
			);
		}

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "page",
				name: name || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: `tryUpdatePageModuleSettings - to update page module settings for link ${linkId}`,
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update page module settings", {
			cause: error,
		}),
);

export interface UpdateWhiteboardModuleSettingsArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
}

/**
 * Updates whiteboard module settings for a specific link
 */
export const tryUpdateWhiteboardModuleSettings = Result.wrap(
	async (args: UpdateWhiteboardModuleSettingsArgs) => {
		const { payload, linkId, name, req, overrideAccess = false } = args;

		// Verify link exists and is a whiteboard module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "whiteboard") {
			throw new InvalidArgumentError(
				`Cannot update whiteboard settings for a ${link.activityModule.type} module`,
			);
		}

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "whiteboard",
				name: name || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: `tryUpdateWhiteboardModuleSettings - to update whiteboard module settings for link ${linkId}`,
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update whiteboard module settings", {
			cause: error,
		}),
);

export interface UpdateFileModuleSettingsArgs extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
}

/**
 * Updates file module settings for a specific link
 */
export const tryUpdateFileModuleSettings = Result.wrap(
	async (args: UpdateFileModuleSettingsArgs) => {
		const { payload, linkId, name, req, overrideAccess = false } = args;

		// Verify link exists and is a file module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "file") {
			throw new InvalidArgumentError(
				`Cannot update file settings for a ${link.activityModule.type} module`,
			);
		}

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "file",
				name: name || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryUpdateFileModuleSettings",
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update file module settings", {
			cause: error,
		}),
);

export interface UpdateAssignmentModuleSettingsArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
	allowSubmissionsFrom?: string;
	dueDate?: string;
	cutoffDate?: string;
	maxAttempts?: number;
}

/**
 * Updates assignment module settings for a specific link
 */
export const tryUpdateAssignmentModuleSettings = Result.wrap(
	async (args: UpdateAssignmentModuleSettingsArgs) => {
		const {
			payload,
			linkId,
			name,
			allowSubmissionsFrom,
			dueDate,
			cutoffDate,
			maxAttempts,
			req,
			overrideAccess = false,
		} = args;

		// Verify link exists and is an assignment module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "assignment") {
			throw new InvalidArgumentError(
				`Cannot update assignment settings for a ${link.activityModule.type} module`,
			);
		}

		// Validate date logic and maxAttempts
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

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "assignment",
				name: name || undefined,
				allowSubmissionsFrom: allowSubmissionsFrom || undefined,
				dueDate: dueDate || undefined,
				cutoffDate: cutoffDate || undefined,
				maxAttempts: maxAttempts || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryUpdateAssignmentModuleSettings",
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update assignment module settings", {
			cause: error,
		}),
);

export interface UpdateQuizModuleSettingsArgs extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
	openingTime?: string;
	closingTime?: string;
	maxAttempts?: number;
}

/**
 * Updates quiz module settings for a specific link
 */
export const tryUpdateQuizModuleSettings = Result.wrap(
	async (args: UpdateQuizModuleSettingsArgs) => {
		const {
			payload,
			linkId,
			name,
			openingTime,
			closingTime,
			maxAttempts,
			req,
			overrideAccess = false,
		} = args;

		// Verify link exists and is a quiz module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "quiz") {
			throw new InvalidArgumentError(
				`Cannot update quiz settings for a ${link.activityModule.type} module`,
			);
		}

		// Validate date logic and maxAttempts
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

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "quiz",
				name: name || undefined,
				openingTime: openingTime || undefined,
				closingTime: closingTime || undefined,
				maxAttempts: maxAttempts || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryUpdateQuizModuleSettings",
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update quiz module settings", {
			cause: error,
		}),
);

export interface UpdateDiscussionModuleSettingsArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
	name?: string;
	dueDate?: string;
	cutoffDate?: string;
}

/**
 * Updates discussion module settings for a specific link
 */
export const tryUpdateDiscussionModuleSettings = Result.wrap(
	async (args: UpdateDiscussionModuleSettingsArgs) => {
		const {
			payload,
			linkId,
			name,
			dueDate,
			cutoffDate,
			req,
			overrideAccess = false,
		} = args;

		// Verify link exists and is a discussion module
		const linkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId,
			req,
			overrideAccess,
		});

		if (!linkResult.ok) {
			throw linkResult.error;
		}

		const link = linkResult.value;
		if (link.activityModule.type !== "discussion") {
			throw new InvalidArgumentError(
				`Cannot update discussion settings for a ${link.activityModule.type} module`,
			);
		}

		// Validate date logic
		if (dueDate && cutoffDate) {
			if (new Date(dueDate) > new Date(cutoffDate)) {
				throw new InvalidArgumentError("Due date must be before cutoff date");
			}
		}

		const settings: LatestCourseModuleSettings = {
			version: "v2",
			settings: {
				type: "discussion",
				name: name || undefined,
				dueDate: dueDate || undefined,
				cutoffDate: cutoffDate || undefined,
			},
		};

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
			})
			.then(stripDepth<1, "update">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryUpdateDiscussionModuleSettings",
					args: { payload, req, overrideAccess },
				});
				throw error;
			});

		return updatedLink;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update discussion module settings", {
			cause: error,
		}),
);

export interface GetCourseModuleSettingsArgs extends BaseInternalFunctionArgs {
	linkId: number;
}

/**
 * Retrieves course module settings for a specific link
 * Returns discriminated union for consistency
 */
export const tryGetCourseModuleSettings = Result.wrap(
	async (args: GetCourseModuleSettingsArgs) => {
		const { payload, linkId, overrideAccess = false, req } = args;
		const link = await payload
			.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				depth: 1,
				overrideAccess,
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

export interface CheckCourseActivityModuleLinkExistsArgs
	extends BaseInternalFunctionArgs {
	courseId: number;
	activityModuleId: number;
}

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
				req,
			})
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryCheckCourseActivityModuleLinkExists",
					args,
				});
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
