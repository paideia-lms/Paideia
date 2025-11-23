import type { Payload, PayloadRequest } from "payload";
import {
	CourseActivityModuleLinks,
	CourseSections,
} from "server/payload.config";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { CourseModuleSettingsV1 } from "../json/course-module-settings.types";
import type {
	CourseActivityModuleLink,
	CourseSection,
	ActivityModule as PayloadActivityModule,
} from "../payload-types";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

// ============================================================================
// Basic CRUD Operations
// ============================================================================

export type CreateSectionArgs = BaseInternalFunctionArgs & {
	data: {
		course: number;
		title: string;
		description?: string;
		parentSection?: number;
		contentOrder?: number;
	};
};

export type UpdateSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	data: {
		title?: string;
		description?: string;
		parentSection?: number;
		contentOrder?: number;
	};
};

export type FindSectionByIdArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

export type DeleteSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

/**
 * Creates a new course section
 */
export const tryCreateSection = Result.wrap(
	async (args: CreateSectionArgs) => {
		const { payload, data, user, req, overrideAccess = false } = args;

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

		try {
			// Verify course exists
			await payload.findByID({
				collection: "courses",
				id: data.course,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// If parent section is specified, verify it exists and belongs to same course
			if (data.parentSection) {
				const parentSection = await payload.findByID({
					collection: CourseSections.slug,
					id: data.parentSection,
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});

				const parentCourseId =
					typeof parentSection.course === "number"
						? parentSection.course
						: parentSection.course.id;

				if (parentCourseId !== data.course) {
					throw new InvalidArgumentError(
						"Parent section must belong to the same course",
					);
				}
			}

			const newSection = await payload.create({
				collection: CourseSections.slug,
				data: {
					course: data.course,
					title: data.title,
					description: data.description,
					parentSection: data.parentSection,
					contentOrder: 999999, // Temporary value, will be recalculated
				},
				depth: 1,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for the parent section to ensure proper ordering
			await recalculateSectionContentOrder(
				payload,
				data.parentSection ?? null,
				transactionInfo.reqWithTransaction,
			);

			// Get the final section with correct contentOrder
			const finalSection = await payload.findByID({
				collection: CourseSections.slug,
				id: newSection.id,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return finalSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create section", { cause: error }),
);

/**
 * Updates an existing course section
 */
export const tryUpdateSection = Result.wrap(
	async (args: UpdateSectionArgs) => {
		const {
			payload,
			sectionId,
			data,
			user,
			req,
			overrideAccess = false,
		} = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get existing section
			const existingSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const existingCourseId =
				typeof existingSection.course === "number"
					? existingSection.course
					: existingSection.course.id;

			const oldParentSectionId =
				typeof existingSection.parentSection === "number"
					? existingSection.parentSection
					: (existingSection.parentSection?.id ?? null);

			// If parent section is being updated, verify it exists and belongs to same course
			if (data.parentSection !== undefined) {
				if (data.parentSection) {
					const parentSection = await payload.findByID({
						collection: CourseSections.slug,
						id: data.parentSection,
						user,
						req: transactionInfo.reqWithTransaction,
						overrideAccess: true,
					});

					const parentCourseId =
						typeof parentSection.course === "number"
							? parentSection.course
							: parentSection.course.id;

					if (parentCourseId !== existingCourseId) {
						throw new InvalidArgumentError(
							"Parent section must belong to the same course",
						);
					}

					// Prevent circular references
					if (data.parentSection === sectionId) {
						throw new InvalidArgumentError("Section cannot be its own parent");
					}

					// Check for deeper circular references
					const hasCircularRef = await checkCircularReference(
						payload,
						sectionId,
						data.parentSection,
						transactionInfo.reqWithTransaction,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// If parent section changed, recalculate contentOrder for affected sections
			if (
				data.parentSection !== undefined &&
				data.parentSection !== oldParentSectionId
			) {
				// Recalculate contentOrder for old parent section
				if (oldParentSectionId !== null) {
					await recalculateSectionContentOrder(
						payload,
						oldParentSectionId,
						transactionInfo.reqWithTransaction,
					);
				}

				// Recalculate contentOrder for new parent section
				await recalculateSectionContentOrder(
					payload,
					data.parentSection,
					transactionInfo.reqWithTransaction,
				);
			}

			// Get the final section with correct contentOrder
			const finalSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return finalSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update section", { cause: error }),
);

/**
 * Finds a section by ID
 */
export const tryFindSectionById = Result.wrap(
	async (args: FindSectionByIdArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		const section = await payload
			.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req,
				overrideAccess,
			})
			.then((s) => {
				const course = s.course;
				assertZodInternal(
					"tryFindSectionById: Course is required",
					course,
					z.object({ id: z.number() }),
				);
				return {
					...s,
					course: course.id,
				};
			});

		return section;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find section by ID", { cause: error }),
);

/**
 * Deletes a section by ID
 */
export const tryDeleteSection = Result.wrap(
	async (args: DeleteSectionArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the section to access its course
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const courseId =
				typeof section.course === "number" ? section.course : section.course.id;

			// Check if section has child sections
			const childSections = await payload.find({
				collection: CourseSections.slug,
				where: {
					parentSection: {
						equals: sectionId,
					},
				},
				limit: 1,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			if (childSections.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete section with child sections. Delete children first.",
				);
			}

			// Check if section has activity modules
			const activityModules = await payload.find({
				collection: CourseActivityModuleLinks.slug,
				where: {
					section: {
						equals: sectionId,
					},
				},
				limit: 1,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			if (activityModules.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete section with activity modules. Remove modules first.",
				);
			}

			// Check if this is the last section in the course
			const courseSections = await payload.find({
				collection: CourseSections.slug,
				where: {
					course: {
						equals: courseId,
					},
				},
				limit: 2, // We only need to know if there are more than 1
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			if (courseSections.docs.length <= 1) {
				throw new InvalidArgumentError(
					"Cannot delete the last section in a course. Every course must have at least one section.",
				);
			}

			const deletedSection = await payload.delete({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return deletedSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete section", { cause: error }),
);

// ============================================================================
// Section Tree Operations
// ============================================================================

export type FindSectionsByCourseArgs = BaseInternalFunctionArgs & {
	courseId: number;
};

export type FindRootSectionsArgs = BaseInternalFunctionArgs & {
	courseId: number;
};

export type FindChildSectionsArgs = BaseInternalFunctionArgs & {
	parentSectionId: number;
};

export type GetSectionTreeArgs = BaseInternalFunctionArgs & {
	courseId: number;
};

export type GetSectionAncestorsArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

export type GetSectionDepthArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

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
export const tryFindSectionsByCourse = Result.wrap(
	async (args: FindSectionsByCourseArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const sections = await payload.find({
			collection: CourseSections.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			sort: "contentOrder",
			pagination: false,
			user,
			req,
			overrideAccess,
		});

		return sections.docs as CourseSection[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find sections by course", { cause: error }),
);

/**
 * Finds root-level sections (sections without parents) in a course
 */
export const tryFindRootSections = Result.wrap(
	async (args: FindRootSectionsArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

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
			user,
			req,
			overrideAccess,
		});

		return sections.docs as CourseSection[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find root sections", { cause: error }),
);

/**
 * Finds direct children of a section
 */
export const tryFindChildSections = Result.wrap(
	async (args: FindChildSectionsArgs) => {
		const {
			payload,
			parentSectionId,
			user,
			req,
			overrideAccess = false,
		} = args;

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
			user,
			req,
			overrideAccess,
		});

		return sections.docs as CourseSection[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find child sections", { cause: error }),
);

/**
 * Builds complete tree structure for a course
 */
export const tryGetSectionTree = Result.wrap(
	async (args: GetSectionTreeArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

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
			user,
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
				user,
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

/**
 * Gets all ancestors of a section from root to the section
 */
export const tryGetSectionAncestors = Result.wrap(
	async (args: GetSectionAncestorsArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

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
				user,
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

/**
 * Calculates the depth of a section (0 for root, 1 for first level, etc.)
 */
export const tryGetSectionDepth = Result.wrap(
	async (args: GetSectionDepthArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		let depth = 0;
		let currentId: number | null = sectionId;

		while (currentId !== null) {
			const section: CourseSection = await payload.findByID({
				collection: CourseSections.slug,
				id: currentId,
				depth: 0,
				user,
				req,
				overrideAccess,
			});

			currentId =
				typeof section.parentSection === "number"
					? section.parentSection
					: (section.parentSection?.id ?? null);

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

// ============================================================================
// Section Ordering Operations
// ============================================================================

export type ReorderSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	newContentOrder: number;
};

export type ReorderSectionsArgs = BaseInternalFunctionArgs & {
	sectionIds: number[];
};

/**
 * Changes order of a section within its parent
 */
export const tryReorderSection = Result.wrap(
	async (args: ReorderSectionArgs) => {
		const {
			payload,
			sectionId,
			newContentOrder,
			user,
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

		try {
			// Get the section to find its parent
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			// Recalculate contentOrder for the parent section (this will normalize all orders)
			await recalculateSectionContentOrder(
				payload,
				parentSectionId,
				transactionInfo.reqWithTransaction,
			);

			// Get the final updated section
			const updatedSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return updatedSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to reorder section", { cause: error }),
);

/**
 * Batch reorder multiple sections at once
 */
export const tryReorderSections = Result.wrap(
	async (args: ReorderSectionsArgs) => {
		const { payload, sectionIds, user, req } = args;

		if (!sectionIds || sectionIds.length === 0) {
			throw new InvalidArgumentError("Section IDs are required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the first section to determine the parent
			const firstSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionIds[0],
				user,
				req: transactionInfo.reqWithTransaction,
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
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess: true,
				});
			}

			// Recalculate contentOrder for the parent section
			await recalculateSectionContentOrder(
				payload,
				parentSectionId,
				transactionInfo.reqWithTransaction,
			);

			await commitTransactionIfCreated(payload, transactionInfo);

			return { success: true, reorderedCount: sectionIds.length };
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to reorder sections", { cause: error }),
);

// ============================================================================
// Section Nesting Operations
// ============================================================================

export type NestSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	newParentSectionId: number;
};

export type UnnestSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

export type MoveSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	newParentSectionId: number | null;
	newOrder: number;
};

/**
 * Moves section under a new parent (validate no circular refs)
 */
export const tryNestSection = Result.wrap(
	async (args: NestSectionArgs) => {
		const {
			payload,
			sectionId,
			newParentSectionId,
			user,
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

		try {
			// Get the section
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const courseId =
				typeof section.course === "number" ? section.course : section.course.id;

			const oldParentSectionId =
				typeof section.parentSection === "number"
					? section.parentSection
					: (section.parentSection?.id ?? null);

			// Get the new parent section
			const parentSection = await payload.findByID({
				collection: CourseSections.slug,
				id: newParentSectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const parentCourseId =
				typeof parentSection.course === "number"
					? parentSection.course
					: parentSection.course.id;

			// Verify both sections belong to same course
			if (courseId !== parentCourseId) {
				throw new InvalidArgumentError(
					"Section and parent section must belong to the same course",
				);
			}

			// Prevent self-nesting
			if (sectionId === newParentSectionId) {
				throw new InvalidArgumentError("Section cannot be nested under itself");
			}

			// Check for circular references
			const hasCircularRef = await checkCircularReference(
				payload,
				sectionId,
				newParentSectionId,
				transactionInfo.reqWithTransaction,
			);

			if (hasCircularRef) {
				throw new InvalidArgumentError(
					"Cannot nest section: would create circular reference",
				);
			}

			// Update the section with temporary contentOrder (will be recalculated)
			await payload.update({
				collection: CourseSections.slug,
				id: sectionId,
				data: {
					parentSection: newParentSectionId,
					contentOrder: 999999, // Temporary value
				},
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for old parent section
			if (oldParentSectionId !== null) {
				await recalculateSectionContentOrder(
					payload,
					oldParentSectionId,
					transactionInfo.reqWithTransaction,
				);
			}

			// Recalculate contentOrder for new parent section
			await recalculateSectionContentOrder(
				payload,
				newParentSectionId,
				transactionInfo.reqWithTransaction,
			);

			// Get the final section with correct contentOrder
			const finalSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return finalSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to nest section", { cause: error }),
);

/**
 * Moves section to root level (set parent to null)
 */
export const tryUnnestSection = Result.wrap(
	async (args: UnnestSectionArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the section
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for old parent section
			if (oldParentSectionId !== null) {
				await recalculateSectionContentOrder(
					payload,
					oldParentSectionId,
					transactionInfo.reqWithTransaction,
				);
			}

			// Recalculate contentOrder for root level
			await recalculateSectionContentOrder(
				payload,
				null, // Root level
				transactionInfo.reqWithTransaction,
			);

			// Get the final section with correct contentOrder
			const finalSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return finalSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to unnest section", { cause: error }),
);

/**
 * Moves section to different parent with new order
 */
export const tryMoveSection = Result.wrap(
	async (args: MoveSectionArgs) => {
		const {
			payload,
			sectionId,
			newParentSectionId,
			newOrder,
			user,
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

		try {
			// Get the section
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const courseId =
				typeof section.course === "number" ? section.course : section.course.id;

			const oldParentSectionId =
				typeof section.parentSection === "number"
					? section.parentSection
					: (section.parentSection?.id ?? null);

			// If moving to a parent, verify it exists and belongs to same course
			if (newParentSectionId) {
				const parentSection = await payload.findByID({
					collection: CourseSections.slug,
					id: newParentSectionId,
					user,
					req: transactionInfo.reqWithTransaction,
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
					transactionInfo.reqWithTransaction,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for old parent section
			if (
				oldParentSectionId !== null &&
				oldParentSectionId !== newParentSectionId
			) {
				await recalculateSectionContentOrder(
					payload,
					oldParentSectionId,
					transactionInfo.reqWithTransaction,
				);
			}

			// Recalculate contentOrder for new parent section
			await recalculateSectionContentOrder(
				payload,
				newParentSectionId,
				transactionInfo.reqWithTransaction,
			);

			// Get the final section with correct contentOrder
			const finalSection = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return finalSection as CourseSection;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to move section", { cause: error }),
);

// ============================================================================
// Activity Module Link Operations
// ============================================================================

export type AddActivityModuleToSectionArgs = BaseInternalFunctionArgs & {
	activityModuleId: number;
	sectionId: number;
	order?: number;
};

export type RemoveActivityModuleFromSectionArgs = BaseInternalFunctionArgs & {
	linkId: number;
};

export type ReorderActivityModulesInSectionArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	linkIds: number[];
};

export type MoveActivityModuleBetweenSectionsArgs = BaseInternalFunctionArgs & {
	linkId: number;
	newSectionId: number;
	newOrder?: number;
};

/**
 * Creates link between activity module and section
 */
export const tryAddActivityModuleToSection = Result.wrap(
	async (args: AddActivityModuleToSectionArgs) => {
		const {
			payload,
			activityModuleId,
			sectionId,
			order,
			user,
			req,
			overrideAccess = false,
		} = args;

		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Verify activity module exists
			await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			// Verify section exists
			const section = await payload.findByID({
				collection: CourseSections.slug,
				id: sectionId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const courseId =
				typeof section.course === "number" ? section.course : section.course.id;

			// Check if link already exists
			const existingLinks = await payload.find({
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			if (existingLinks.docs.length > 0) {
				throw new InvalidArgumentError(
					"Activity module is already linked to this section",
				);
			}

			// Get next order number if not provided
			let linkOrder = order ?? 0;
			if (linkOrder === 0) {
				const existingModules = await payload.find({
					collection: CourseActivityModuleLinks.slug,
					where: {
						section: {
							equals: sectionId,
						},
					},
					limit: 1,
					sort: "-contentOrder",
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess: true,
				});

				linkOrder =
					existingModules.docs.length > 0
						? (existingModules.docs[0].contentOrder ?? 0) + 1
						: 1;
			}

			// Create the link with temporary contentOrder (will be recalculated)
			const newLink = await payload.create({
				collection: CourseActivityModuleLinks.slug,
				data: {
					course: courseId,
					activityModule: activityModuleId,
					section: sectionId,
					contentOrder: 999999, // Temporary value, will be recalculated
				},
				depth: 1,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for the section
			await recalculateSectionContentOrder(
				payload,
				sectionId,
				transactionInfo.reqWithTransaction,
			);

			await commitTransactionIfCreated(payload, transactionInfo);

			return newLink as CourseActivityModuleLink;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to add activity module to section", {
			cause: error,
		}),
);

/**
 * Removes link between activity module and section
 */
export const tryRemoveActivityModuleFromSection = Result.wrap(
	async (args: RemoveActivityModuleFromSectionArgs) => {
		const { payload, linkId, user, req, overrideAccess = false } = args;

		if (!linkId) {
			throw new InvalidArgumentError("Link ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the link to find its section before deleting
			const link = await payload.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess: true,
			});

			const sectionId =
				typeof link.section === "number" ? link.section : link.section.id;

			const deletedLink = await payload.delete({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for the section
			await recalculateSectionContentOrder(
				payload,
				sectionId,
				transactionInfo.reqWithTransaction,
			);

			await commitTransactionIfCreated(payload, transactionInfo);

			return deletedLink;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to remove activity module from section", {
			cause: error,
		}),
);

/**
 * Reorders modules within a section
 */
export const tryReorderActivityModulesInSection = Result.wrap(
	async (args: ReorderActivityModulesInSectionArgs) => {
		const {
			payload,
			sectionId,
			linkIds,
			user,
			req,
			overrideAccess = false,
		} = args;

		if (!sectionId) {
			throw new InvalidArgumentError("Section ID is required");
		}

		if (!linkIds || linkIds.length === 0) {
			throw new InvalidArgumentError("Link IDs are required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Update each link with its new order
			for (let i = 0; i < linkIds.length; i++) {
				await payload.update({
					collection: CourseActivityModuleLinks.slug,
					id: linkIds[i],
					data: { contentOrder: i },
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});
			}

			await commitTransactionIfCreated(payload, transactionInfo);

			return { success: true, reorderedCount: linkIds.length };
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to reorder activity modules in section", {
			cause: error,
		}),
);

/**
 * Moves module from one section to another
 */
export const tryMoveActivityModuleBetweenSections = Result.wrap(
	async (args: MoveActivityModuleBetweenSectionsArgs) => {
		const {
			payload,
			linkId,
			newSectionId,
			newOrder,
			user,
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

		try {
			// Get the existing link
			const existingLink = await payload.findByID({
				collection: CourseActivityModuleLinks.slug,
				id: linkId,
				user,
				req: transactionInfo.reqWithTransaction,
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
				user,
				req: transactionInfo.reqWithTransaction,
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
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess: true,
				});

				linkOrder =
					existingModules.docs.length > 0
						? (existingModules.docs[0].contentOrder ?? 0) + 1
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			// Recalculate contentOrder for old section
			if (oldSectionId !== newSectionId) {
				await recalculateSectionContentOrder(
					payload,
					oldSectionId,
					transactionInfo.reqWithTransaction,
				);
			}

			// Recalculate contentOrder for new section
			await recalculateSectionContentOrder(
				payload,
				newSectionId,
				transactionInfo.reqWithTransaction,
			);

			await commitTransactionIfCreated(payload, transactionInfo);

			return updatedLink as CourseActivityModuleLink;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to move activity module between sections", {
			cause: error,
		}),
);

// ============================================================================
// Validation & Utilities
// ============================================================================

export type ValidateNoCircularReferenceArgs = BaseInternalFunctionArgs & {
	sectionId: number;
	newParentSectionId: number;
};

export type GetSectionModulesCountArgs = BaseInternalFunctionArgs & {
	sectionId: number;
};

/**
 * Ensures parent change won't create circular reference
 *
 * ! this should only be used in testing and development
 */
export const tryValidateNoCircularReference = Result.wrap(
	async (args: ValidateNoCircularReferenceArgs) => {
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
		new UnknownError("Failed to validate circular reference", { cause: error }),
);

/**
 * Counts activity modules in a section
 */
export const tryGetSectionModulesCount = Result.wrap(
	async (args: GetSectionModulesCountArgs) => {
		const { payload, sectionId, user, req, overrideAccess = false } = args;

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
			user,
			req,
			overrideAccess,
		});

		return countResult.totalDocs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get section modules count", { cause: error }),
);

// ============================================================================
// Course Structure Representation
// ============================================================================

export interface ActivityModuleSummary {
	id: number;
	title: string;
	type: PayloadActivityModule["type"];
	status: PayloadActivityModule["status"];
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

export type GetCourseStructureArgs = BaseInternalFunctionArgs & {
	courseId: number;
};

/**
 * recursively assert the content order is correct
 */
function assertRightContentOrder(
	sections: (CourseStructureItem | CourseStructureSection)[],
): void {
	for (let i = 0; i < sections.length; i++) {
		const section = sections[i];
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

/**
 * Gets the complete course structure as a hierarchical JSON representation with mixed content ordering
 */
export const tryGetCourseStructure = Result.wrap(
	async (args: GetCourseStructureArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		// Get all sections for the course
		const sectionsResult = await payload.find({
			collection: CourseSections.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			sort: "contentOrder",
			pagination: false,
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		// Get all activity module links for the course
		const activityModuleLinks = await payload.find({
			collection: CourseActivityModuleLinks.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			sort: "contentOrder",
			pagination: false,
			depth: 1,
			user,
			req,
			overrideAccess,
		});

		// Create maps for efficient lookup
		const sectionMap = new Map<number, CourseStructureSection>();
		const sectionModulesMap = new Map<number, CourseActivityModuleLink[]>();
		const rootSections: CourseStructureSection[] = [];

		// Group activity modules by section
		for (const link of activityModuleLinks.docs) {
			const sectionId =
				typeof link.section === "number" ? link.section : link.section.id;
			if (!sectionModulesMap.has(sectionId)) {
				sectionModulesMap.set(sectionId, []);
			}
			const existingLinks = sectionModulesMap.get(sectionId);
			if (existingLinks) {
				existingLinks.push(link as CourseActivityModuleLink);
			}
		}

		// First pass: create all section nodes
		for (const section of sectionsResult.docs) {
			const structureSection: CourseStructureSection = {
				id: section.id,
				title: section.title,
				description: section.description || "",
				contentOrder: section.contentOrder || 0,
				type: "section",
				content: [],
			};

			sectionMap.set(section.id, structureSection);
		}

		// Second pass: build the hierarchy and populate content
		for (const section of sectionsResult.docs) {
			const structureSection = sectionMap.get(section.id);
			if (!structureSection) continue;

			const parentId =
				typeof section.parentSection === "number"
					? section.parentSection
					: (section.parentSection?.id ?? null);

			// Get activity modules for this section
			const activityModules = sectionModulesMap.get(section.id) || [];

			// Create mixed content array
			const mixedContent: (CourseStructureItem | CourseStructureSection)[] = [];

			// Add activity modules to content
			for (const link of activityModules) {
				const activityModule = link.activityModule;

				assertZodInternal(
					"tryGetCourseStructure: Activity module is required",
					activityModule,
					z.object({ id: z.number() }),
				);

				// Use custom name from settings if available, otherwise use module title
				const linkSettings = link.settings as CourseModuleSettingsV1 | null;
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
						status: activityModule.status,
					},
				});
			}

			// Add child sections to content
			for (const childSection of sectionsResult.docs) {
				const childParentId =
					typeof childSection.parentSection === "number"
						? childSection.parentSection
						: (childSection.parentSection?.id ?? null);

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
				mixedContent[i].contentOrder = i;
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
			rootSections[i].contentOrder = i;
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

		const section: CourseSection = await payload.findByID({
			collection: CourseSections.slug,
			id: currentId,
			depth: 0,
			req,
			overrideAccess: true,
		});

		currentId =
			typeof section.parentSection === "number"
				? section.parentSection
				: (section.parentSection?.id ?? null);
	}

	return false; // No circular reference
}

export type GeneralMoveArgs = BaseInternalFunctionArgs & {
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
};

/**
 * General move function that handles moving sections and activity modules with automatic order/contentOrder calculation
 */
export const tryGeneralMove = Result.wrap(
	async (args: GeneralMoveArgs) => {
		const {
			payload,
			source,
			target,
			location,
			user,
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

		try {
			// Get source item
			const sourceItem =
				source.type === "section"
					? await payload
						.findByID({
							collection: CourseSections.slug,
							id: source.id,
							user,
							req: transactionInfo.reqWithTransaction,
							overrideAccess: true,
						})
						.then((result) => {
							const parentSection = result.parentSection;
							assertZodInternal(
								"tryGeneralMove: Parent section is required",
								parentSection,
								z.object({ id: z.number() }).nullish(),
							);
							const course = result.course;
							assertZodInternal(
								"tryGeneralMove: Course is required",
								course,
								z.object({ id: z.number() }),
							);
							return {
								...result,
								parentSection,
								course,
							};
						})
					: await payload
						.findByID({
							collection: CourseActivityModuleLinks.slug,
							id: source.id,
							user,
							req: transactionInfo.reqWithTransaction,
							overrideAccess: true,
						})
						.then((result) => {
							const section = result.section;
							assertZodInternal(
								"tryGeneralMove: Section is required",
								section,
								z.object({ id: z.number() }),
							);
							const course = result.course;
							assertZodInternal(
								"tryGeneralMove: Course is required",
								course,
								z.object({ id: z.number() }),
							);
							return {
								...result,
								section,
								course,
							};
						});

			// Get target item (skip for root moves)
			const targetItem =
				target.type === "section"
					? await payload
						.findByID({
							collection: CourseSections.slug,
							id: target.id,
							user,
							req: transactionInfo.reqWithTransaction,
							overrideAccess: true,
						})
						.then((result) => {
							const parentSection = result.parentSection;
							assertZodInternal(
								"tryGeneralMove: Parent section is required",
								parentSection,
								z.object({ id: z.number() }).nullish(),
							);
							const course = result.course;
							assertZodInternal(
								"tryGeneralMove: Course is required",
								course,
								z.object({ id: z.number() }),
							);
							return {
								...result,
								parentSection,
								course,
							};
						})
					: await payload
						.findByID({
							collection: CourseActivityModuleLinks.slug,
							id: target.id,
							user,
							req: transactionInfo.reqWithTransaction,
							overrideAccess: true,
						})
						.then((result) => {
							const section = result.section;
							assertZodInternal(
								"tryGeneralMove: Section is required",
								section,
								z.object({ id: z.number() }),
							);
							const course = result.course;
							assertZodInternal(
								"tryGeneralMove: Course is required",
								course,
								z.object({ id: z.number() }),
							);
							return {
								...result,
								section,
								course,
							};
						});
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
			assertZodInternal(
				"tryGeneralMove: Source item is required",
				sourceItem,
				z.object({ id: z.number() }),
			);
			const oldParentSection =
				"parentSection" in sourceItem
					? sourceItem.parentSection
					: "section" in sourceItem
						? sourceItem.section
						: null;
			const oldParentSectionId =
				typeof oldParentSection === "number"
					? oldParentSection
					: (oldParentSection?.id ?? null);
			assertZodInternal(
				"tryGeneralMove: Old parent section ID is required",
				oldParentSectionId,
				z.number().nullable(),
			);

			if (location === "inside") {
				newParentSectionId = target.id;

				// Check for circular reference if moving section inside another section
				if (source.type === "section" && newParentSectionId !== null) {
					const hasCircularRef = await checkCircularReference(
						payload,
						source.id,
						newParentSectionId,
						transactionInfo.reqWithTransaction,
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
					user,
					req: transactionInfo.reqWithTransaction,
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
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});
			}

			// Recalculate contentOrder for affected sections
			// 1. Recalculate source section (if different from target)
			if (oldParentSectionId !== newParentSectionId) {
				await recalculateSectionContentOrder(
					payload,
					oldParentSectionId,
					transactionInfo.reqWithTransaction,
				);
			}

			// 2. Recalculate target section
			await recalculateSectionContentOrder(
				payload,
				newParentSectionId,
				transactionInfo.reqWithTransaction,
			);

			// Get the final updated item with correct contentOrder
			const finalResult =
				source.type === "section"
					? await payload.findByID({
						collection: CourseSections.slug,
						id: source.id,
						user,
						req: transactionInfo.reqWithTransaction,
						overrideAccess: true,
					})
					: await payload.findByID({
						collection: CourseActivityModuleLinks.slug,
						id: source.id,
						user,
						req: transactionInfo.reqWithTransaction,
						overrideAccess: true,
					});

			await commitTransactionIfCreated(payload, transactionInfo);
			return finalResult;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to perform general move", { cause: error }),
);

/**
 * Helper function to recalculate contentOrder for all items in a section, starting from 0
 */
async function recalculateSectionContentOrder(
	payload: Payload,
	sectionId: number | null,
	req?: Partial<PayloadRequest>,
): Promise<void> {
	// Get all sections with same parent
	const siblingSections = await payload.find({
		collection: CourseSections.slug,
		where: {
			parentSection: sectionId ? { equals: sectionId } : { exists: false },
		},
		sort: "contentOrder",
		pagination: false,
		user: undefined,
		req,
		overrideAccess: true,
	});

	// Get all activity module links with same parent
	const siblingModules = await payload.find({
		collection: CourseActivityModuleLinks.slug,
		where: {
			section: sectionId ? { equals: sectionId } : { exists: false },
		},
		sort: "contentOrder",
		pagination: false,
		user: undefined,
		req,
		overrideAccess: true,
	});

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
	for (let i = 0; i < allContent.length; i++) {
		const contentItem = allContent[i];
		const newContentOrder = i;

		if (contentItem.type === "section") {
			await payload.update({
				collection: CourseSections.slug,
				id: contentItem.item.id,
				data: { contentOrder: newContentOrder },
				user: undefined,
				req,
				overrideAccess: true,
			});
		} else {
			await payload.update({
				collection: CourseActivityModuleLinks.slug,
				id: contentItem.item.id,
				data: { contentOrder: newContentOrder },
				user: undefined,
				req,
				overrideAccess: true,
			});
		}
	}
}
