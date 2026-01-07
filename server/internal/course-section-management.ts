import type { Payload, PayloadRequest } from "payload";
import { CourseActivityModuleLinks } from "../collections/course-activity-module-links";
import { CourseSections } from "../collections/course-sections";
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type {
	CourseActivityModuleLink,
	CourseSection,
	ActivityModule as PayloadActivityModule,
} from "../payload-types";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import type { LatestCourseModuleSettings } from "server/json";
import { groupBy } from "node_modules/es-toolkit/dist/array/groupBy.mjs";

// ============================================================================
// Basic CRUD Operations
// ============================================================================

export interface CreateSectionArgs extends BaseInternalFunctionArgs {
	data: {
		course: number;
		title: string;
		description?: string;
		parentSection?: number;
		contentOrder?: number;
	};
}

export interface UpdateSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
	data: {
		title?: string;
		description?: string;
		parentSection?: number;
		contentOrder?: number;
	};
}

export interface FindSectionByIdArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

export interface DeleteSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

/**
 * Creates a new course section
 */
export function tryCreateSection(args: CreateSectionArgs) {
	return Result.try(
		async () => {
			const { payload, data, req, overrideAccess = false } = args;

			if (!data.course) {
				throw new InvalidArgumentError("Course ID is required");
			}

			if (!data.title) {
				throw new InvalidArgumentError("Section title is required");
			}

			if (!data.description) {
				throw new InvalidArgumentError("Section description is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// If parent section is specified, verify it exists and belongs to same course
				if (data.parentSection) {
					const parentSection = await payload
						.findByID({
							collection: CourseSections.slug,
							id: data.parentSection,
							req: txInfo.reqWithTransaction,
							depth: 0,
							overrideAccess,
						})
						.then(stripDepth<0, "findByID">());

					const parentCourseId = parentSection.course;

					if (parentCourseId !== data.course) {
						throw new InvalidArgumentError(
							"Parent section must belong to the same course",
						);
					}
				}

				const newSection = await payload
					.create({
						collection: CourseSections.slug,
						data: {
							course: data.course,
							title: data.title,
							description: data.description,
							parentSection: data.parentSection,
							contentOrder: 999999, // Temporary value, will be recalculated
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<0, "create">());

				// Recalculate contentOrder for the parent section to ensure proper ordering
				await recalculateSectionContentOrder({
					payload,
					sectionId: data.parentSection ?? null,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				// Get the final section with correct contentOrder
				const finalSection = await payload
					.findByID({
						collection: CourseSections.slug,
						id: newSection.id,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">());

				return finalSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create section", { cause: error }),
	);
}

/**
 * Updates an existing course section
 */
export function tryUpdateSection(args: UpdateSectionArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, data, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get existing section
				const existingSection = await payload
					.findByID({
						collection: CourseSections.slug,
						id: sectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					})
					.then(stripDepth<0, "findByID">());

				const existingCourseId = existingSection.course;

				const oldParentSectionId = existingSection.parentSection ?? null;

				// If parent section is being updated, verify it exists and belongs to same course
				if (data.parentSection !== undefined) {
					if (data.parentSection) {
						const parentSection = await payload
							.findByID({
								collection: CourseSections.slug,
								id: data.parentSection,
								req: txInfo.reqWithTransaction,
								overrideAccess: true,
							})
							.then(stripDepth<0, "findByID">());

						const parentCourseId = parentSection.course;

						if (parentCourseId !== existingCourseId) {
							throw new InvalidArgumentError(
								"Parent section must belong to the same course",
							);
						}

						// Prevent circular references
						if (data.parentSection === sectionId) {
							throw new InvalidArgumentError(
								"Section cannot be its own parent",
							);
						}

						// Check for deeper circular references
						const hasCircularRef = await checkCircularReference(
							payload,
							sectionId,
							data.parentSection,
							txInfo.reqWithTransaction,
						);

						if (hasCircularRef) {
							throw new InvalidArgumentError(
								"Cannot set parent: would create circular reference",
							);
						}
					}
				}

				await payload.update({
					collection: CourseSections.slug,
					id: sectionId,
					data,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// If parent section changed, recalculate contentOrder for affected sections
				if (
					data.parentSection !== undefined &&
					data.parentSection !== oldParentSectionId
				) {
					// Recalculate contentOrder for old parent section
					if (oldParentSectionId !== null) {
						await recalculateSectionContentOrder({
							payload,
							sectionId: oldParentSectionId,
							req: txInfo.reqWithTransaction,
							overrideAccess: true,
						});
					}

					// Recalculate contentOrder for new parent section
					await recalculateSectionContentOrder({
						payload,
						sectionId: data.parentSection,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Get the final section with correct contentOrder
				const finalSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return finalSection as CourseSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update section", { cause: error }),
	);
}

/**
 * Finds a section by ID
 */
export function tryFindSectionById(args: FindSectionByIdArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const section = await payload
				.findByID({
					collection: CourseSections.slug,
					id: sectionId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return section;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find section by ID", { cause: error }),
	);
}

/**
 * Deletes a section by ID
 */
export function tryDeleteSection(args: DeleteSectionArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the section to access its course
				const section = await payload
					.findByID({
						collection: CourseSections.slug,
						id: sectionId,

						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">());

				const courseId = section.course;

				// Check if section has child sections or activity modules in parallel
				const [childSections, activityModules] = await Promise.all([
					payload.count({
						collection: CourseSections.slug,
						where: {
							parentSection: {
								equals: sectionId,
							},
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						// ! system request, we don't care about access control here
						overrideAccess: true,
					}),
					payload.count({
						collection: CourseActivityModuleLinks.slug,
						where: {
							section: {
								equals: sectionId,
							},
						},
						req: txInfo.reqWithTransaction,
						// ! system request, we don't care about access control here
						overrideAccess: true,
					}),
				]);

				if (childSections.totalDocs > 0) {
					throw new InvalidArgumentError(
						"Cannot delete section with child sections. Delete children first.",
					);
				}

				if (activityModules.totalDocs > 0) {
					throw new InvalidArgumentError(
						"Cannot delete section with activity modules. Remove modules first.",
					);
				}

				// Check if this is the last section in the course
				const courseSections = await payload.count({
					collection: CourseSections.slug,
					where: {
						course: {
							equals: courseId,
						},
					},
					req: txInfo.reqWithTransaction,
					// ! this is a system request, we don't care about access control here
					overrideAccess: true,
				});

				if (courseSections.totalDocs <= 1) {
					throw new InvalidArgumentError(
						"Cannot delete the last section in a course. Every course must have at least one section.",
					);
				}

				const deletedSection = await payload
					.delete({
						collection: CourseSections.slug,
						id: sectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "delete">());

				return deletedSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete section", { cause: error }),
	);
}

// ============================================================================
// Section Tree Operations
// ============================================================================

export interface FindSectionsByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface FindRootSectionsArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface FindChildSectionsArgs extends BaseInternalFunctionArgs {
	parentSectionId: number;
}

export interface GetSectionTreeArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface GetSectionAncestorsArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

export interface GetSectionDepthArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

export interface SectionTreeNode {
	id: number;
	title: string;
	description?: string | null;
	parentSection: number | null;
	contentOrder: number;
	course: number;
	activityModulesCount: number;
	childSections: SectionTreeNode[];
}

/**
 * Finds all sections in a course, sorted by contentOrder
 */
export function tryFindSectionsByCourse(args: FindSectionsByCourseArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const sections = await payload
				.find({
					collection: CourseSections.slug,
					where: {
						course: {
							equals: courseId,
						},
					},
					sort: "contentOrder",
					pagination: false,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "find">());

			return sections.docs as CourseSection[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find sections by course", { cause: error }),
	);
}

/**
 * Finds root-level sections (sections without parents) in a course
 */
export function tryFindRootSections(args: FindRootSectionsArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const sections = await payload.find({
				collection: CourseSections.slug,
				where: {
					and: [
						{
							course: {
								equals: courseId,
							},
						},
						{
							parentSection: {
								exists: false,
							},
						},
					],
				},
				sort: "contentOrder",
				req,
				overrideAccess,
			});

			return sections.docs as CourseSection[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find root sections", { cause: error }),
	);
}

/**
 * Finds direct children of a section
 */
export function tryFindChildSections(args: FindChildSectionsArgs) {
	return Result.try(
		async () => {
			const { payload, parentSectionId, req, overrideAccess = false } = args;

			if (!parentSectionId) {
				throw new InvalidArgumentError("Parent section ID is required");
			}

			const sections = await payload.find({
				collection: CourseSections.slug,
				where: {
					parentSection: {
						equals: parentSectionId,
					},
				},
				sort: "contentOrder",
				req,
				overrideAccess,
			});

			return sections.docs as CourseSection[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find child sections", { cause: error }),
	);
}

/**
 * Builds complete tree structure for a course
 */
export function tryGetSectionTree(args: GetSectionTreeArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const allSections = await payload.find({
				collection: CourseSections.slug,
				where: {
					course: {
						equals: courseId,
					},
				},
				sort: "contentOrder",
				pagination: false,
				depth: 0,
				req,
				overrideAccess,
			});

			// Build tree structure
			const sectionMap = new Map<number, SectionTreeNode>();
			const rootSections: SectionTreeNode[] = [];

			// First pass: create all nodes
			for (const section of allSections.docs) {
				const activityModulesCountResult = await payload.count({
					collection: CourseActivityModuleLinks.slug,
					where: {
						section: {
							equals: section.id,
						},
					},

					req,
					overrideAccess: true,
				});

				const node: SectionTreeNode = {
					id: section.id,
					title: section.title,
					description: section.description ?? "",
					parentSection:
						typeof section.parentSection === "number"
							? section.parentSection
							: (section.parentSection?.id ?? null),
					contentOrder: section.contentOrder,
					course:
						typeof section.course === "number"
							? section.course
							: section.course.id,
					activityModulesCount: activityModulesCountResult.totalDocs,
					childSections: [],
				};

				sectionMap.set(section.id, node);
			}

			// Second pass: build tree
			for (const node of sectionMap.values()) {
				if (node.parentSection === null) {
					rootSections.push(node);
				} else {
					const parentNode = sectionMap.get(node.parentSection);
					if (parentNode) {
						parentNode.childSections.push(node);
					}
				}
			}

			return rootSections;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get section tree", { cause: error }),
	);
}

/**
 * Gets all ancestors of a section from root to the section
 */
export function tryGetSectionAncestors(args: GetSectionAncestorsArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const ancestors: CourseSection[] = [];
			let currentId: number | null = sectionId;

			while (currentId !== null) {
				const section: CourseSection = await payload.findByID({
					collection: CourseSections.slug,
					id: currentId,
					depth: 0,

					req,
					overrideAccess,
				});

				ancestors.unshift(section);

				currentId =
					typeof section.parentSection === "number"
						? section.parentSection
						: (section.parentSection?.id ?? null);
			}

			return ancestors;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get section ancestors", { cause: error }),
	);
}

/**
 * Calculates the depth of a section (0 for root, 1 for first level, etc.)
 */
export function tryGetSectionDepth(args: GetSectionDepthArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			let depth = 0;
			let currentId: number | null = sectionId;

			while (currentId !== null) {
				const section: { id: number; parentSection?: number | null } =
					await payload
						.findByID({
							collection: CourseSections.slug,
							id: currentId,
							depth: 0,
							req,
							overrideAccess,
						})
						.then(stripDepth<0, "findByID">());

				currentId = section.parentSection ?? null;

				if (currentId !== null) {
					depth++;
				}
			}

			return depth;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to calculate section depth", { cause: error }),
	);
}

// ============================================================================
// Section Ordering Operations
// ============================================================================

export interface ReorderSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
	newContentOrder: number;
}

export interface ReorderSectionsArgs extends BaseInternalFunctionArgs {
	sectionIds: number[];
}

/**
 * Changes order of a section within its parent
 */
export function tryReorderSection(args: ReorderSectionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				sectionId,
				newContentOrder,
				req,
				overrideAccess = false,
			} = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			if (newContentOrder < 0) {
				throw new InvalidArgumentError("Content order must be non-negative");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the section to find its parent
				const section = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				const parentSectionId =
					typeof section.parentSection === "number"
						? section.parentSection
						: (section.parentSection?.id ?? null);

				// Set the desired contentOrder temporarily (will be adjusted by recalculation)
				await payload.update({
					collection: CourseSections.slug,
					id: sectionId,
					data: { contentOrder: newContentOrder },

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				// Recalculate contentOrder for the parent section (this will normalize all orders)
				await recalculateSectionContentOrder({
					payload,
					sectionId: parentSectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				// Get the final updated section
				const updatedSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return updatedSection as CourseSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder section", { cause: error }),
	);
}

/**
 * Batch reorder multiple sections at once
 */
export function tryReorderSections(args: ReorderSectionsArgs) {
	return Result.try(
		async () => {
			const { payload, sectionIds, req } = args;

			if (!sectionIds || sectionIds.length === 0) {
				throw new InvalidArgumentError("Section IDs are required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the first section to determine the parent
				const firstSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionIds[0]!,

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				const parentSectionId =
					typeof firstSection.parentSection === "number"
						? firstSection.parentSection
						: (firstSection.parentSection?.id ?? null);

				// Temporarily set high contentOrder for all sections to be reordered
				for (const sectionId of sectionIds) {
					await payload.update({
						collection: CourseSections.slug,
						id: sectionId,
						data: { contentOrder: 999999 },

						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Recalculate contentOrder for the parent section
				await recalculateSectionContentOrder({
					payload,
					sectionId: parentSectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				return { success: true, reorderedCount: sectionIds.length };
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder sections", { cause: error }),
	);
}

// ============================================================================
// Section Nesting Operations
// ============================================================================

export interface NestSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
	newParentSectionId: number;
}

export interface UnnestSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

export interface MoveSectionArgs extends BaseInternalFunctionArgs {
	sectionId: number;
	newParentSectionId: number | null;
	newOrder: number;
}

/**
 * Moves section under a new parent (validate no circular refs)
 */
export function tryNestSection(args: NestSectionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				sectionId,
				newParentSectionId,
				req,
				overrideAccess = false,
			} = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			if (!newParentSectionId) {
				throw new InvalidArgumentError("New parent section ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the section
				const section = await payload
					.findByID({
						collection: CourseSections.slug,
						id: sectionId,

						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">());

				const courseId = section.course;

				const oldParentSectionId = section.parentSection ?? null;

				// Get the new parent section
				const parentSection = await payload
					.findByID({
						collection: CourseSections.slug,
						id: newParentSectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">());

				const parentCourseId = parentSection.course;

				// Verify both sections belong to same course
				if (courseId !== parentCourseId) {
					throw new InvalidArgumentError(
						"Section and parent section must belong to the same course",
					);
				}

				// Prevent self-nesting
				if (sectionId === newParentSectionId) {
					throw new InvalidArgumentError(
						"Section cannot be nested under itself",
					);
				}

				// Check for circular references
				const hasCircularRef = await checkCircularReference(
					payload,
					sectionId,
					newParentSectionId,
					txInfo.reqWithTransaction,
				);

				if (hasCircularRef) {
					throw new InvalidArgumentError(
						"Cannot nest section: would create circular reference",
					);
				}

				// Update the section with temporary contentOrder (will be recalculated)
				await payload
					.update({
						collection: CourseSections.slug,
						id: sectionId,
						data: {
							parentSection: newParentSectionId,
							contentOrder: 999999, // Temporary value
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				// Recalculate contentOrder for old parent section
				if (oldParentSectionId !== null) {
					await recalculateSectionContentOrder({
						payload,
						sectionId: oldParentSectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Recalculate contentOrder for new parent section
				await recalculateSectionContentOrder({
					payload,
					sectionId: newParentSectionId,
					req: txInfo.reqWithTransaction,
					// ! this system request
					overrideAccess: true,
				});

				// Get the final section with correct contentOrder
				const finalSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return finalSection as CourseSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to nest section", { cause: error }),
	);
}

/**
 * Moves section to root level (set parent to null)
 */
export function tryUnnestSection(args: UnnestSectionArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the section
				const section = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				const oldParentSectionId =
					typeof section.parentSection === "number"
						? section.parentSection
						: (section.parentSection?.id ?? null);

				// Update the section with temporary contentOrder (will be recalculated)
				await payload.update({
					collection: CourseSections.slug,
					id: sectionId,
					data: {
						parentSection: null,
						contentOrder: 999999, // Temporary value
					},

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// Recalculate contentOrder for old parent section
				if (oldParentSectionId !== null) {
					await recalculateSectionContentOrder({
						payload,
						sectionId: oldParentSectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Recalculate contentOrder for root level
				await recalculateSectionContentOrder({
					payload,
					sectionId: null, // Root level
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				// Get the final section with correct contentOrder
				const finalSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return finalSection as CourseSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to unnest section", { cause: error }),
	);
}

/**
 * Moves section to different parent with new order
 */
export function tryMoveSection(args: MoveSectionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				sectionId,
				newParentSectionId,
				newOrder,
				req,
				overrideAccess = false,
			} = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			if (newOrder < 0) {
				throw new InvalidArgumentError("Order must be non-negative");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the section
				const section = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				const courseId =
					typeof section.course === "number"
						? section.course
						: section.course.id;

				const oldParentSectionId =
					typeof section.parentSection === "number"
						? section.parentSection
						: (section.parentSection?.id ?? null);

				// If moving to a parent, verify it exists and belongs to same course
				if (newParentSectionId) {
					const parentSection = await payload.findByID({
						collection: CourseSections.slug,
						id: newParentSectionId,

						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});

					const parentCourseId =
						typeof parentSection.course === "number"
							? parentSection.course
							: parentSection.course.id;

					if (courseId !== parentCourseId) {
						throw new InvalidArgumentError(
							"Section and parent section must belong to the same course",
						);
					}

					// Prevent self-move
					if (sectionId === newParentSectionId) {
						throw new InvalidArgumentError(
							"Section cannot be moved under itself",
						);
					}

					// Check for circular references
					const hasCircularRef = await checkCircularReference(
						payload,
						sectionId,
						newParentSectionId,
						txInfo.reqWithTransaction,
					);

					if (hasCircularRef) {
						throw new InvalidArgumentError(
							"Cannot move section: would create circular reference",
						);
					}
				}

				// Update the section with temporary contentOrder (will be recalculated)
				await payload.update({
					collection: CourseSections.slug,
					id: sectionId,
					data: {
						parentSection: newParentSectionId,
						contentOrder: 999999, // Temporary value, will be recalculated
					},

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// Recalculate contentOrder for old parent section
				if (
					oldParentSectionId !== null &&
					oldParentSectionId !== newParentSectionId
				) {
					await recalculateSectionContentOrder({
						payload,
						sectionId: oldParentSectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Recalculate contentOrder for new parent section
				await recalculateSectionContentOrder({
					payload,
					sectionId: newParentSectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				// Get the final section with correct contentOrder
				const finalSection = await payload.findByID({
					collection: CourseSections.slug,
					id: sectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return finalSection as CourseSection;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to move section", { cause: error }),
	);
}

// ============================================================================
// Activity Module Link Operations
// ============================================================================

export interface AddActivityModuleToSectionArgs
	extends BaseInternalFunctionArgs {
	activityModuleId: number;
	sectionId: number;
	order?: number;
}

export interface RemoveActivityModuleFromSectionArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
}

export interface ReorderActivityModulesInSectionArgs
	extends BaseInternalFunctionArgs {
	sectionId: number;
	linkIds: number[];
}

export interface MoveActivityModuleBetweenSectionsArgs
	extends BaseInternalFunctionArgs {
	linkId: number;
	newSectionId: number;
	newOrder?: number;
}

/**
 * Creates link between activity module and section
 */
export function tryAddActivityModuleToSection(
	args: AddActivityModuleToSectionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				sectionId,
				order,
				req,
				overrideAccess = false,
			} = args;

			if (!activityModuleId) {
				throw new InvalidArgumentError("Activity module ID is required");
			}

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			// Verify activity module and section exist in parallel
			const [_, section] = await Promise.all([
				payload.findByID({
					collection: "activity-modules",
					id: activityModuleId,
					depth: 0,
					req,
					overrideAccess: true,
				}),
				payload
					.findByID({
						collection: CourseSections.slug,
						id: sectionId,
						depth: 1,
						req,
						overrideAccess: true,
					})
					.then(stripDepth<1, "findByID">()),
			]);
			const courseId = section.course.id;
			// Check if link already exists
			const existingLinks = await payload
				.find({
					collection: CourseActivityModuleLinks.slug,
					where: {
						and: [
							{
								activityModule: {
									equals: activityModuleId,
								},
							},
							{
								section: {
									equals: sectionId,
								},
							},
						],
					},
					limit: 1,

					req,
					overrideAccess: true,
				})
				.then(stripDepth<1, "find">());

			if (existingLinks.docs.length > 0) {
				throw new InvalidArgumentError(
					"Activity module is already linked to this section",
				);
			}
			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get next order number if not provided
				let linkOrder = order ?? 0;
				if (linkOrder === 0) {
					const existingModules = await payload
						.find({
							collection: CourseActivityModuleLinks.slug,
							where: {
								section: {
									equals: sectionId,
								},
							},
							limit: 1,
							sort: "-contentOrder",
							req: txInfo.reqWithTransaction,
							overrideAccess: true,
						})
						.then(stripDepth<1, "find">());
					linkOrder =
						existingModules.docs.length > 0
							? (existingModules.docs[0]!.contentOrder ?? 0) + 1
							: 1;
				}

				// Create the link with temporary contentOrder (will be recalculated)
				const newLink = await payload
					.create({
						collection: CourseActivityModuleLinks.slug,
						data: {
							course: courseId,
							activityModule: activityModuleId,
							section: sectionId,
							contentOrder: 999999, // Temporary value, will be recalculated
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "create">());

				// Recalculate contentOrder for the section
				await recalculateSectionContentOrder({
					payload,
					sectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				return newLink;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add activity module to section", {
				cause: error,
			}),
	);
}

/**
 * Removes link between activity module and section
 */
export function tryRemoveActivityModuleFromSection(
	args: RemoveActivityModuleFromSectionArgs,
) {
	return Result.try(
		async () => {
			const { payload, linkId, req, overrideAccess = false } = args;

			if (!linkId) {
				throw new InvalidArgumentError("Link ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the link to find its section before deleting
				const link = await payload.findByID({
					collection: CourseActivityModuleLinks.slug,
					id: linkId,

					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				const sectionId =
					typeof link.section === "number" ? link.section : link.section.id;

				const deletedLink = await payload.delete({
					collection: CourseActivityModuleLinks.slug,
					id: linkId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// Recalculate contentOrder for the section
				await recalculateSectionContentOrder({
					payload,
					sectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				return deletedLink;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove activity module from section", {
				cause: error,
			}),
	);
}

/**
 * Reorders modules within a section
 */
export function tryReorderActivityModulesInSection(
	args: ReorderActivityModulesInSectionArgs,
) {
	return Result.try(
		async () => {
			const { payload, sectionId, linkIds, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			if (!linkIds || linkIds.length === 0) {
				throw new InvalidArgumentError("Link IDs are required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Update each link with its new order
				for (let i = 0; i < linkIds.length; i++) {
					await payload.update({
						collection: CourseActivityModuleLinks.slug,
						id: linkIds[i]!,
						data: { contentOrder: i },

						req: txInfo.reqWithTransaction,
						overrideAccess,
					});
				}

				return { success: true, reorderedCount: linkIds.length };
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder activity modules in section", {
				cause: error,
			}),
	);
}

/**
 * Moves module from one section to another
 */
export function tryMoveActivityModuleBetweenSections(
	args: MoveActivityModuleBetweenSectionsArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				linkId,
				newSectionId,
				newOrder,
				req,
				overrideAccess = false,
			} = args;

			if (!linkId) {
				throw new InvalidArgumentError("Link ID is required");
			}

			if (!newSectionId) {
				throw new InvalidArgumentError("New section ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get the existing link
				const existingLink = await payload.findByID({
					collection: CourseActivityModuleLinks.slug,
					id: linkId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				const courseId =
					typeof existingLink.course === "number"
						? existingLink.course
						: existingLink.course.id;

				const oldSectionId =
					typeof existingLink.section === "number"
						? existingLink.section
						: existingLink.section.id;

				// Verify new section exists and belongs to same course
				const newSection = await payload.findByID({
					collection: CourseSections.slug,
					id: newSectionId,

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				const newSectionCourseId =
					typeof newSection.course === "number"
						? newSection.course
						: newSection.course.id;

				if (courseId !== newSectionCourseId) {
					throw new InvalidArgumentError(
						"Activity module and new section must belong to the same course",
					);
				}

				// Get next order number if not provided
				let linkOrder = newOrder ?? 0;
				if (linkOrder === 0) {
					const existingModules = await payload.find({
						collection: CourseActivityModuleLinks.slug,
						where: {
							section: {
								equals: newSectionId,
							},
						},
						limit: 1,
						sort: "-contentOrder",

						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});

					linkOrder =
						existingModules.docs.length > 0
							? (existingModules.docs[0]!.contentOrder ?? 0) + 1
							: 1;
				}

				// Update the link with temporary contentOrder (will be recalculated)
				const updatedLink = await payload.update({
					collection: CourseActivityModuleLinks.slug,
					id: linkId,
					data: {
						section: newSectionId,
						contentOrder: 999999, // Temporary value, will be recalculated
					},

					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				// Recalculate contentOrder for old section
				if (oldSectionId !== newSectionId) {
					await recalculateSectionContentOrder({
						payload,
						sectionId: oldSectionId,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					});
				}

				// Recalculate contentOrder for new section
				await recalculateSectionContentOrder({
					payload,
					sectionId: newSectionId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				return updatedLink as CourseActivityModuleLink;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to move activity module between sections", {
				cause: error,
			}),
	);
}

// ============================================================================
// Validation & Utilities
// ============================================================================

export interface ValidateNoCircularReferenceArgs
	extends BaseInternalFunctionArgs {
	sectionId: number;
	newParentSectionId: number;
}

export interface GetSectionModulesCountArgs extends BaseInternalFunctionArgs {
	sectionId: number;
}

/**
 * Ensures parent change won't create circular reference
 *
 * ! this should only be used in testing and development
 */
export function tryValidateNoCircularReference(
	args: ValidateNoCircularReferenceArgs,
) {
	return Result.try(
		async () => {
			const { payload, sectionId, newParentSectionId, req } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			if (!newParentSectionId) {
				throw new InvalidArgumentError("New parent section ID is required");
			}

			const hasCircularRef = await checkCircularReference(
				payload,
				sectionId,
				newParentSectionId,
				req,
			);

			return !hasCircularRef;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to validate circular reference", {
				cause: error,
			}),
	);
}

/**
 * Counts activity modules in a section
 */
export function tryGetSectionModulesCount(args: GetSectionModulesCountArgs) {
	return Result.try(
		async () => {
			const { payload, sectionId, req, overrideAccess = false } = args;

			if (!sectionId) {
				throw new InvalidArgumentError("Section ID is required");
			}

			const countResult = await payload.count({
				collection: CourseActivityModuleLinks.slug,
				where: {
					section: {
						equals: sectionId,
					},
				},
				req,
				overrideAccess,
			});

			return countResult.totalDocs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get section modules count", { cause: error }),
	);
}

// ============================================================================
// Course Structure Representation
// ============================================================================

export interface ActivityModuleSummary {
	id: number;
	title: string;
	type: PayloadActivityModule["type"];
}

export interface CourseStructureItem {
	/**
	 * the module link id
	 */
	id: number;
	type: "activity-module";
	contentOrder: number;
	module: ActivityModuleSummary;
}

export interface CourseStructureSection {
	/**
	 * the section id
	 */
	id: number;
	title: string;
	description: string;
	contentOrder: number;
	type: "section";
	content: (CourseStructureItem | CourseStructureSection)[];
}

export interface CourseStructure {
	courseId: number;
	sections: CourseStructureSection[];
}

export interface GetCourseStructureArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

type Section = {
	id: number;
	title: string;
	description: string;
	contentOrder: number;
	type: "section";
	content: any[];
};

type SectionItem = {
	id: number;
	type: "activity-module";
	contentOrder: number;
	module: ActivityModuleSummary;
};

/**
 * recursively assert the content order is correct
 */
function assertRightContentOrder(sections: (SectionItem | Section)[]): void {
	for (let i = 0; i < sections.length; i++) {
		const section = sections[i]!;
		if (section.type === "section") {
			if (section.contentOrder !== i) {
				throw new InvalidArgumentError(
					`Section ${section.title} has incorrect content order: ${section.contentOrder}, expected: ${i}`,
				);
			}
			assertRightContentOrder(section.content);
		} else {
			if (section.contentOrder !== i) {
				throw new InvalidArgumentError(
					`Activity module ${section.module.title} has incorrect content order: ${section.contentOrder}, expected: ${i}`,
				);
			}
		}
	}
}

type MapValue<T> = T extends Map<any, infer V> ? V : never;

/**
 * Gets the complete course structure as a hierarchical JSON representation with mixed content ordering
 */
export function tryGetCourseStructure(args: GetCourseStructureArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			// Get all sections for the course
			const sectionsResult = await payload
				.find({
					collection: CourseSections.slug,
					where: {
						course: {
							equals: courseId,
						},
					},
					sort: "contentOrder",
					pagination: false,
					depth: 0,
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "find">());

			// Get all activity module links for the course
			const activityModuleLinks = await payload
				.find({
					collection: CourseActivityModuleLinks.slug,
					where: {
						course: {
							equals: courseId,
						},
					},
					sort: "contentOrder",
					pagination: false,
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			// Create maps for efficient lookup
			const sectionMap = new Map(
				sectionsResult.docs.map((section) => [
					section.id,
					{
						id: section.id,
						title: section.title,
						description: section.description || "",
						contentOrder: section.contentOrder || 0,
						type: "section" as const,
						content: [] as any[],
					},
				]),
			);
			const sectionModulesMap = new Map(
				Object.entries(
					groupBy(activityModuleLinks.docs, (link) => link.section.id),
				).map(([sectionId, links]) => [Number(sectionId), links]),
			);
			const rootSections: MapValue<typeof sectionMap>[] = [];

			// // Group activity modules by section
			// for (const link of activityModuleLinks.docs) {
			// 	const sectionId = link.section.id;
			// 	if (!sectionModulesMap.has(sectionId)) {
			// 		sectionModulesMap.set(sectionId, []);
			// 	}
			// 	const existingLinks = sectionModulesMap.get(sectionId);
			// 	if (existingLinks) {
			// 		existingLinks.push(link as CourseActivityModuleLink);
			// 	}
			// }

			// First pass: create all section nodes
			// for (const section of sectionsResult.docs) {
			// 	const structureSection: CourseStructureSection = {
			// 		id: section.id,
			// 		title: section.title,
			// 		description: section.description || "",
			// 		contentOrder: section.contentOrder || 0,
			// 		type: "section",
			// 		content: [],
			// 	};

			// 	sectionMap.set(section.id, structureSection);
			// }

			// Second pass: build the hierarchy and populate content
			for (const section of sectionsResult.docs) {
				const structureSection = sectionMap.get(section.id);
				if (!structureSection) continue;

				const parentId = section.parentSection ?? null;

				// Get activity modules for this section
				const activityModules = sectionModulesMap.get(section.id) || [];

				// Create mixed content array
				const mixedContent: (SectionItem | Section)[] = [];

				// Add activity modules to content
				for (const link of activityModules) {
					const activityModule = link.activityModule;

					// Use custom name from settings if available, otherwise use module title
					const linkSettings =
						link.settings as LatestCourseModuleSettings | null;
					const moduleTitle =
						linkSettings?.settings?.name ?? activityModule.title;

					mixedContent.push({
						id: link.id,
						type: "activity-module",
						contentOrder: link.contentOrder || 0,
						module: {
							id: activityModule.id,
							title: moduleTitle,
							type: activityModule.type,
						},
					});
				}

				// Add child sections to content
				for (const childSection of sectionsResult.docs) {
					const childParentId = childSection.parentSection ?? null;

					if (childParentId === section.id) {
						const childStructureSection = sectionMap.get(childSection.id);
						if (childStructureSection) {
							mixedContent.push(childStructureSection);
						}
					}
				}

				// Sort content by contentOrder, then by type (sections before activity modules)
				mixedContent.sort((a, b) => {
					if (a.contentOrder !== b.contentOrder) {
						return a.contentOrder - b.contentOrder;
					}
					// When contentOrder is equal, sections come before activity modules
					if (a.type === "section" && b.type === "activity-module") {
						return -1;
					}
					if (a.type === "activity-module" && b.type === "section") {
						return 1;
					}
					return 0;
				});

				// Normalize contentOrder to start from 0 with no gaps
				for (let i = 0; i < mixedContent.length; i++) {
					mixedContent[i]!.contentOrder = i;
				}

				structureSection.content = mixedContent;

				// Add to root sections if no parent
				if (parentId === null) {
					rootSections.push(structureSection);
				}
			}

			// Sort root sections by contentOrder
			rootSections.sort((a, b) => a.contentOrder - b.contentOrder);

			// Normalize root sections contentOrder to start from 0
			for (let i = 0; i < rootSections.length; i++) {
				rootSections[i]!.contentOrder = i;
			}

			assertRightContentOrder(rootSections);

			return {
				courseId,
				sections: rootSections,
			} as CourseStructure;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get course structure", { cause: error }),
	);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper function to check for circular references
 */
async function checkCircularReference(
	payload: Payload,
	sectionId: number,
	newParentSectionId: number,
	req?: Partial<PayloadRequest>,
): Promise<boolean> {
	let currentId: number | null = newParentSectionId;

	while (currentId !== null) {
		if (currentId === sectionId) {
			return true; // Circular reference found
		}

		const section: { id: number; parentSection?: number | null } = await payload
			.findByID({
				collection: CourseSections.slug,
				id: currentId,
				depth: 0,
				req,
				// ! system request, we don't care about access control here
				overrideAccess: true,
			})
			.then(stripDepth<0, "findByID">());

		currentId = section.parentSection ?? null;
	}

	return false; // No circular reference
}

export interface GeneralMoveArgs extends BaseInternalFunctionArgs {
	source: {
		id: number;
		type: "section" | "activity-module";
	};
	// the target cannot be null, even for move into the root level becasue there is always 1 section, which means there will be reference for below and above
	target: {
		id: number;
		type: "section" | "activity-module";
	};
	// we need the inside operation because it is possible that the target is a empty section and we have no reference for below or above
	location: "below" | "above" | "inside";
}

/**
 * General move function that handles moving sections and activity modules with automatic order/contentOrder calculation
 */
export function tryGeneralMove(args: GeneralMoveArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				source,
				target,
				location,
				req,
				overrideAccess = false,
			} = args;

			if (!source.id) {
				throw new InvalidArgumentError("Source ID is required");
			}

			if (!target.id) {
				throw new InvalidArgumentError("Target ID is required");
			}

			// Cannot move anything inside an activity module
			if (location === "inside" && target.type === "activity-module") {
				throw new InvalidArgumentError(
					"Cannot move items inside an activity module",
				);
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get source item
				const sourceItem =
					source.type === "section"
						? await payload
								.findByID({
									collection: CourseSections.slug,
									id: source.id,
									depth: 1,
									req: txInfo.reqWithTransaction,
									overrideAccess: true,
								})
								.then(stripDepth<1, "findByID">())
						: await payload
								.findByID({
									collection: CourseActivityModuleLinks.slug,
									id: source.id,
									depth: 1,
									req: txInfo.reqWithTransaction,
									overrideAccess: true,
								})
								.then(stripDepth<1, "findByID">());

				// Get target item (skip for root moves)
				const targetItem =
					target.type === "section"
						? await payload
								.findByID({
									collection: CourseSections.slug,
									id: target.id,
									depth: 1,
									req: txInfo.reqWithTransaction,
									overrideAccess: true,
								})
								.then(stripDepth<1, "findByID">())
						: await payload
								.findByID({
									collection: CourseActivityModuleLinks.slug,
									id: target.id,
									depth: 1,
									req: txInfo.reqWithTransaction,
									overrideAccess: true,
								})
								.then(stripDepth<1, "findByID">());
				// Determine course ID
				const sourceCourseId = sourceItem.course.id;

				const targetCourseId = targetItem.course.id;
				// Verify both items belong to same course
				if (sourceCourseId !== targetCourseId) {
					throw new InvalidArgumentError(
						"Source and target must belong to the same course",
					);
				}

				// Determine new parent section
				let newParentSectionId: number | null;

				const oldParentSection =
					"parentSection" in sourceItem
						? sourceItem.parentSection
						: "section" in sourceItem
							? sourceItem.section
							: null;
				const oldParentSectionId = oldParentSection?.id ?? null;

				if (location === "inside") {
					newParentSectionId = target.id;

					// Check for circular reference if moving section inside another section
					if (source.type === "section" && newParentSectionId !== null) {
						const hasCircularRef = await checkCircularReference(
							payload,
							source.id,
							newParentSectionId,
							txInfo.reqWithTransaction,
						);

						if (hasCircularRef) {
							throw new InvalidArgumentError(
								"Cannot move section: would create circular reference",
							);
						}
					}
				} else {
					// Moving above or below target - get target's parent
					if (target.type === "section" && "parentSection" in targetItem) {
						const targetSection = targetItem;
						newParentSectionId = targetSection.parentSection?.id ?? null;
					} else if (
						target.type === "activity-module" &&
						"section" in targetItem
					) {
						const targetLink = targetItem;
						newParentSectionId = targetLink.section.id;
					} else {
						throw new InvalidArgumentError("Invalid target type");
					}
				}

				// Calculate appropriate contentOrder based on location
				let newContentOrder: number;
				if (!targetItem) {
					throw new InvalidArgumentError("Target item not found");
				}
				if (location === "above") {
					newContentOrder = targetItem.contentOrder - 0.5; // Same as target, stable sort by ID will determine order
				} else if (location === "below") {
					newContentOrder = targetItem.contentOrder + 0.5; // Right after target
				} else {
					// "inside" - put at the end
					newContentOrder = 999999;
				}

				// Move the item to its new location
				if (source.type === "section") {
					await payload.update({
						collection: CourseSections.slug,
						id: source.id,
						data: {
							parentSection: newParentSectionId,
							// Temporary contentOrder, will be recalculated
							contentOrder: newContentOrder,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
					});
				} else {
					// Update activity module link
					if (!newParentSectionId) {
						throw new InvalidArgumentError(
							"Activity module must be assigned to a section",
						);
					}

					await payload.update({
						collection: CourseActivityModuleLinks.slug,
						id: source.id,
						data: {
							section: newParentSectionId,
							// Temporary contentOrder, will be recalculated
							contentOrder: newContentOrder,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
					});
				}

				// Recalculate contentOrder for affected sections
				// 1. Recalculate source section (if different from target)
				if (oldParentSectionId !== newParentSectionId) {
					await recalculateSectionContentOrder({
						payload,
						sectionId: oldParentSectionId,
						req: txInfo.reqWithTransaction,
						// ! we might not need to check access here
						overrideAccess: true,
					});
				}

				// 2. Recalculate target section
				await recalculateSectionContentOrder({
					payload,
					sectionId: newParentSectionId,
					req: txInfo.reqWithTransaction,
					// ! we might not need to check access here
					overrideAccess: true,
				});

				// Get the final updated item with correct contentOrder
				const finalResult =
					source.type === "section"
						? await payload.findByID({
								collection: CourseSections.slug,
								id: source.id,
								req: txInfo.reqWithTransaction,
								overrideAccess: true,
							})
						: await payload.findByID({
								collection: CourseActivityModuleLinks.slug,
								id: source.id,
								req: txInfo.reqWithTransaction,
								overrideAccess: true,
							});

				return finalResult;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to perform general move", { cause: error }),
	);
}

export interface GetPreviousNextModuleArgs extends BaseInternalFunctionArgs {
	courseId: number;
	moduleLinkId: number;
}

export interface PreviousNextModule {
	id: number;
	title: string;
	type: PayloadActivityModule["type"];
}

export interface PreviousNextModuleResult {
	previousModule: PreviousNextModule | null;
	nextModule: PreviousNextModule | null;
}

/**
 * Gets the previous and next modules for navigation
 * Based on the flattened course structure order
 */
export function tryGetPreviousNextModule(args: GetPreviousNextModuleArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				moduleLinkId,
				req,
				overrideAccess = false,
			} = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			if (!moduleLinkId) {
				throw new InvalidArgumentError("Module link ID is required");
			}

			// Get course structure to determine next/previous modules
			const courseStructure = await tryGetCourseStructure({
				payload,
				courseId,
				req,
				overrideAccess,
			}).getOrThrow();

			// Get flattened modules with info for previous/next calculation
			const flattenedModules =
				flattenCourseStructureWithModuleInfo(courseStructure);
			const currentModuleIndex = flattenedModules.findIndex(
				(m) => m.moduleLinkId === moduleLinkId,
			);

			const _previousModule =
				currentModuleIndex > 0
					? flattenedModules[currentModuleIndex - 1]!
					: null;
			const _nextModule =
				currentModuleIndex < flattenedModules.length - 1
					? flattenedModules[currentModuleIndex + 1]!
					: null;

			const previousModule = _previousModule
				? {
						id: _previousModule.moduleLinkId,
						title: _previousModule.title,
						type: _previousModule.type,
					}
				: null;

			const nextModule = _nextModule
				? {
						id: _nextModule.moduleLinkId,
						title: _nextModule.title,
						type: _nextModule.type,
					}
				: null;

			return {
				previousModule,
				nextModule,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get previous/next module", { cause: error }),
	);
}

interface RecalculateSectionContentOrderArgs extends BaseInternalFunctionArgs {
	sectionId: number | null;
}

async function recalculateSectionContentOrder(
	args: RecalculateSectionContentOrderArgs,
): Promise<void> {
	const { payload, sectionId, req, overrideAccess = false } = args;

	const [siblingSections, siblingModules] = await Promise.all([
		payload
			.find({
				collection: CourseSections.slug,
				where: {
					parentSection: sectionId ? { equals: sectionId } : { exists: false },
				},
				sort: "contentOrder",
				pagination: false,
				depth: 0,
				req,
				// ! this is a system request, we don't care about access control
				overrideAccess,
			})
			.then(stripDepth<0, "find">()),
		payload
			.find({
				collection: CourseActivityModuleLinks.slug,
				where: {
					section: sectionId ? { equals: sectionId } : { exists: false },
				},
				sort: "contentOrder",
				pagination: false,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "find">()),
	]);

	// Combine and sort all content items by current contentOrder, then by ID for stability
	const allContent = [
		...siblingSections.docs.map((section) => ({
			type: "section" as const,
			item: section,
		})),
		...siblingModules.docs.map((module) => ({
			type: "module" as const,
			item: module,
		})),
	].sort((a, b) => {
		const orderDiff = a.item.contentOrder - b.item.contentOrder;
		if (orderDiff !== 0) return orderDiff;
		// If contentOrder is the same, sort by ID (higher ID first for stability)
		return b.item.id - a.item.id;
	});

	// Reassign contentOrder starting from 0
	await Promise.all(
		allContent.map((contentItem, i) => {
			const newContentOrder = i;

			if (contentItem.type === "section") {
				return payload
					.update({
						collection: CourseSections.slug,
						id: contentItem.item.id,
						data: { contentOrder: newContentOrder },
						req,
						overrideAccess: true,
						depth: 1,
					})
					.then(stripDepth<1, "update">());
			} else {
				return payload
					.update({
						collection: CourseActivityModuleLinks.slug,
						id: contentItem.item.id,
						data: { contentOrder: newContentOrder },
						req,
						overrideAccess: true,
						depth: 1,
					})
					.then(stripDepth<1, "update">());
			}
		}),
	);
}
