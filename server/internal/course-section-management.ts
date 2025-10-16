import type { Payload, PayloadRequest } from "payload";
import { CourseSections, CourseActivityModuleLinks } from "server/payload.config";
import { assertZod, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
    InvalidArgumentError,
    TransactionIdNotFoundError,
    transformError,
    UnknownError,
} from "~/utils/error";
import type { CourseSection, CourseActivityModuleLink, User } from "../payload-types";

// ============================================================================
// Basic CRUD Operations
// ============================================================================

export interface CreateSectionArgs {
    payload: Payload;
    data: {
        course: number;
        title: string;
        description?: string;
        parentSection?: number;
        order?: number;
    };
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface UpdateSectionArgs {
    payload: Payload;
    sectionId: number;
    data: {
        title?: string;
        description?: string;
        parentSection?: number;
        order?: number;
    };
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface FindSectionByIdArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface DeleteSectionArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

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

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Verify course exists
            await payload.findByID({
                collection: "courses",
                id: data.course,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            // If parent section is specified, verify it exists and belongs to same course
            if (data.parentSection) {
                const parentSection = await payload.findByID({
                    collection: CourseSections.slug,
                    id: data.parentSection,
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
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

                // Prevent circular references
                if (data.parentSection === data.course) {
                    throw new InvalidArgumentError("Section cannot be its own parent");
                }
            }

            // Get next order number if not provided
            let order = data.order ?? 0;
            if (order === 0) {
                const siblings = await payload.find({
                    collection: CourseSections.slug,
                    where: {
                        and: [
                            {
                                course: {
                                    equals: data.course,
                                },
                            },
                            {
                                parentSection: data.parentSection
                                    ? { equals: data.parentSection }
                                    : { exists: false },
                            },
                        ],
                    },
                    limit: 1,
                    sort: "-order",
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
                });

                order = siblings.docs.length > 0 ? siblings.docs[0].order + 1 : 1;
            }

            const newSection = await payload.create({
                collection: CourseSections.slug,
                data: {
                    course: data.course,
                    title: data.title,
                    description: data.description,
                    parentSection: data.parentSection,
                    order,
                },
                depth: 1,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return newSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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
        const { payload, sectionId, data, user, req, overrideAccess = false } = args;

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get existing section
            const existingSection = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const existingCourseId =
                typeof existingSection.course === "number"
                    ? existingSection.course
                    : existingSection.course.id;

            // If parent section is being updated, verify it exists and belongs to same course
            if (data.parentSection !== undefined) {
                if (data.parentSection) {
                    const parentSection = await payload.findByID({
                        collection: CourseSections.slug,
                        id: data.parentSection,
                        user,
                        req: req ? { ...req, transactionID } : { transactionID },
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
                        req ? { ...req, transactionID } : { transactionID },
                    );

                    if (hasCircularRef) {
                        throw new InvalidArgumentError(
                            "Cannot set parent: would create circular reference",
                        );
                    }
                }
            }

            const updatedSection = await payload.update({
                collection: CourseSections.slug,
                id: sectionId,
                data,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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

        const section = await payload.findByID({
            collection: CourseSections.slug,
            id: sectionId,
            depth: 1,
            user,
            req,
            overrideAccess,
        });

        return section as CourseSection;
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

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
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
                req: req ? { ...req, transactionID } : { transactionID },
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
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            if (activityModules.docs.length > 0) {
                throw new InvalidArgumentError(
                    "Cannot delete section with activity modules. Remove modules first.",
                );
            }

            const deletedSection = await payload.delete({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return deletedSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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

export interface FindSectionsByCourseArgs {
    payload: Payload;
    courseId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface FindRootSectionsArgs {
    payload: Payload;
    courseId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface FindChildSectionsArgs {
    payload: Payload;
    parentSectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface GetSectionTreeArgs {
    payload: Payload;
    courseId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface GetSectionAncestorsArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface GetSectionDepthArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface SectionTreeNode {
    id: number;
    title: string;
    description?: string | null;
    parentSection: number | null;
    order: number;
    course: number;
    activityModulesCount: number;
    childSections: SectionTreeNode[];
}

/**
 * Finds all sections in a course, sorted by order
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
            sort: "order",
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
            sort: "order",
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
        const { payload, parentSectionId, user, req, overrideAccess = false } = args;

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
            sort: "order",
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
            sort: "order",
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
                        : section.parentSection?.id ?? null,
                order: section.order,
                course: typeof section.course === "number" ? section.course : section.course.id,
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
            const section: any = await payload.findByID({
                collection: CourseSections.slug,
                id: currentId,
                depth: 0,
                user,
                req,
                overrideAccess,
            });

            ancestors.unshift(section as CourseSection);

            currentId =
                typeof section.parentSection === "number"
                    ? section.parentSection
                    : section.parentSection?.id ?? null;
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
            const section: any = await payload.findByID({
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
                    : section.parentSection?.id ?? null;

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

export interface ReorderSectionArgs {
    payload: Payload;
    sectionId: number;
    newOrder: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface ReorderSectionsArgs {
    payload: Payload;
    sectionIds: number[];
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

/**
 * Changes order of a section within its parent
 */
export const tryReorderSection = Result.wrap(
    async (args: ReorderSectionArgs) => {
        const { payload, sectionId, newOrder, user, req, overrideAccess = false } = args;

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        if (newOrder < 0) {
            throw new InvalidArgumentError("Order must be non-negative");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get the section to find its parent
            const section = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const parentSectionId =
                typeof section.parentSection === "number"
                    ? section.parentSection
                    : section.parentSection?.id ?? null;

            const courseId =
                typeof section.course === "number" ? section.course : section.course.id;

            // Get all siblings
            const siblings = await payload.find({
                collection: CourseSections.slug,
                where: {
                    and: [
                        {
                            course: {
                                equals: courseId,
                            },
                        },
                        {
                            parentSection: parentSectionId
                                ? { equals: parentSectionId }
                                : { exists: false },
                        },
                        {
                            id: {
                                not_equals: sectionId,
                            },
                        },
                    ],
                },
                sort: "order",
                pagination: false,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            // Adjust orders
            const siblingsArray = siblings.docs;
            let adjustedOrder = newOrder;

            // Ensure order doesn't exceed siblings count
            if (adjustedOrder > siblingsArray.length) {
                adjustedOrder = siblingsArray.length;
            }

            // Update sibling orders
            for (let i = 0; i < siblingsArray.length; i++) {
                let siblingOrder = i;
                if (i >= adjustedOrder) {
                    siblingOrder = i + 1;
                }

                await payload.update({
                    collection: CourseSections.slug,
                    id: siblingsArray[i].id,
                    data: { order: siblingOrder },
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
                });
            }

            // Update the target section
            const updatedSection = await payload.update({
                collection: CourseSections.slug,
                id: sectionId,
                data: { order: adjustedOrder },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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
        const { payload, sectionIds, user, req, overrideAccess = false } = args;

        if (!sectionIds || sectionIds.length === 0) {
            throw new InvalidArgumentError("Section IDs are required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Update each section with its new order
            for (let i = 0; i < sectionIds.length; i++) {
                await payload.update({
                    collection: CourseSections.slug,
                    id: sectionIds[i],
                    data: { order: i },
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess,
                });
            }

            await payload.db.commitTransaction(transactionID);

            return { success: true, reorderedCount: sectionIds.length };
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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

export interface NestSectionArgs {
    payload: Payload;
    sectionId: number;
    newParentSectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface UnnestSectionArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface MoveSectionArgs {
    payload: Payload;
    sectionId: number;
    newParentSectionId: number | null;
    newOrder: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

/**
 * Moves section under a new parent (validate no circular refs)
 */
export const tryNestSection = Result.wrap(
    async (args: NestSectionArgs) => {
        const { payload, sectionId, newParentSectionId, user, req, overrideAccess = false } = args;

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        if (!newParentSectionId) {
            throw new InvalidArgumentError("New parent section ID is required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get the section
            const section = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const courseId =
                typeof section.course === "number" ? section.course : section.course.id;

            // Get the new parent section
            const parentSection = await payload.findByID({
                collection: CourseSections.slug,
                id: newParentSectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
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
                req ? { ...req, transactionID } : { transactionID },
            );

            if (hasCircularRef) {
                throw new InvalidArgumentError(
                    "Cannot nest section: would create circular reference",
                );
            }

            // Get next order number in the new parent
            const siblings = await payload.find({
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
                                equals: newParentSectionId,
                            },
                        },
                    ],
                },
                limit: 1,
                sort: "-order",
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const newOrder = siblings.docs.length > 0 ? siblings.docs[0].order + 1 : 1;

            // Update the section
            const updatedSection = await payload.update({
                collection: CourseSections.slug,
                id: sectionId,
                data: {
                    parentSection: newParentSectionId,
                    order: newOrder,
                },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get the section
            const section = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const courseId =
                typeof section.course === "number" ? section.course : section.course.id;

            // Get next order number at root level
            const rootSections = await payload.find({
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
                limit: 1,
                sort: "-order",
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const newOrder = rootSections.docs.length > 0 ? rootSections.docs[0].order + 1 : 1;

            // Update the section
            const updatedSection = await payload.update({
                collection: CourseSections.slug,
                id: sectionId,
                data: {
                    parentSection: null,
                    order: newOrder,
                },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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
        const { payload, sectionId, newParentSectionId, newOrder, user, req, overrideAccess = false } = args;

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        if (newOrder < 0) {
            throw new InvalidArgumentError("Order must be non-negative");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get the section
            const section = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const courseId =
                typeof section.course === "number" ? section.course : section.course.id;

            // If moving to a parent, verify it exists and belongs to same course
            if (newParentSectionId) {
                const parentSection = await payload.findByID({
                    collection: CourseSections.slug,
                    id: newParentSectionId,
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
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
                    throw new InvalidArgumentError("Section cannot be moved under itself");
                }

                // Check for circular references
                const hasCircularRef = await checkCircularReference(
                    payload,
                    sectionId,
                    newParentSectionId,
                    req ? { ...req, transactionID } : { transactionID },
                );

                if (hasCircularRef) {
                    throw new InvalidArgumentError(
                        "Cannot move section: would create circular reference",
                    );
                }
            }

            // Get siblings in the target location
            const siblings = await payload.find({
                collection: CourseSections.slug,
                where: {
                    and: [
                        {
                            course: {
                                equals: courseId,
                            },
                        },
                        {
                            parentSection: newParentSectionId
                                ? { equals: newParentSectionId }
                                : { exists: false },
                        },
                        {
                            id: {
                                not_equals: sectionId,
                            },
                        },
                    ],
                },
                sort: "order",
                pagination: false,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            // Adjust orders
            const siblingsArray = siblings.docs;
            let adjustedOrder = newOrder;

            // Ensure order doesn't exceed siblings count
            if (adjustedOrder > siblingsArray.length) {
                adjustedOrder = siblingsArray.length;
            }

            // If there are no siblings, use the requested order (0-based)
            // If there are siblings, ensure order doesn't exceed siblings count
            if (siblingsArray.length === 0) {
                adjustedOrder = newOrder;
            }

            // Update sibling orders
            for (let i = 0; i < siblingsArray.length; i++) {
                let siblingOrder = i;
                if (i >= adjustedOrder) {
                    siblingOrder = i + 1;
                }

                await payload.update({
                    collection: CourseSections.slug,
                    id: siblingsArray[i].id,
                    data: { order: siblingOrder },
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
                });
            }

            // Update the target section
            const updatedSection = await payload.update({
                collection: CourseSections.slug,
                id: sectionId,
                data: {
                    parentSection: newParentSectionId,
                    order: adjustedOrder,
                },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedSection as CourseSection;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
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

export interface AddActivityModuleToSectionArgs {
    payload: Payload;
    activityModuleId: number;
    sectionId: number;
    order?: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface RemoveActivityModuleFromSectionArgs {
    payload: Payload;
    linkId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface ReorderActivityModulesInSectionArgs {
    payload: Payload;
    sectionId: number;
    linkIds: number[];
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

export interface MoveActivityModuleBetweenSectionsArgs {
    payload: Payload;
    linkId: number;
    newSectionId: number;
    newOrder?: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

/**
 * Creates link between activity module and section
 */
export const tryAddActivityModuleToSection = Result.wrap(
    async (args: AddActivityModuleToSectionArgs) => {
        const { payload, activityModuleId, sectionId, order, user, req, overrideAccess = false } = args;

        if (!activityModuleId) {
            throw new InvalidArgumentError("Activity module ID is required");
        }

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Verify activity module exists
            await payload.findByID({
                collection: "activity-modules",
                id: activityModuleId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            // Verify section exists
            const section = await payload.findByID({
                collection: CourseSections.slug,
                id: sectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
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
                req: req ? { ...req, transactionID } : { transactionID },
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
                    sort: "-order",
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
                });

                linkOrder = existingModules.docs.length > 0 ? existingModules.docs[0].order + 1 : 1;
            }

            // Create the link
            const newLink = await payload.create({
                collection: CourseActivityModuleLinks.slug,
                data: {
                    course: courseId,
                    activityModule: activityModuleId,
                    section: sectionId,
                    order: linkOrder,
                },
                depth: 1,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return newLink as CourseActivityModuleLink;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to add activity module to section", { cause: error }),
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

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            const deletedLink = await payload.delete({
                collection: CourseActivityModuleLinks.slug,
                id: linkId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return deletedLink;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to remove activity module from section", { cause: error }),
);

/**
 * Reorders modules within a section
 */
export const tryReorderActivityModulesInSection = Result.wrap(
    async (args: ReorderActivityModulesInSectionArgs) => {
        const { payload, sectionId, linkIds, user, req, overrideAccess = false } = args;

        if (!sectionId) {
            throw new InvalidArgumentError("Section ID is required");
        }

        if (!linkIds || linkIds.length === 0) {
            throw new InvalidArgumentError("Link IDs are required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Update each link with its new order
            for (let i = 0; i < linkIds.length; i++) {
                await payload.update({
                    collection: CourseActivityModuleLinks.slug,
                    id: linkIds[i],
                    data: { order: i },
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess,
                });
            }

            await payload.db.commitTransaction(transactionID);

            return { success: true, reorderedCount: linkIds.length };
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to reorder activity modules in section", { cause: error }),
);

/**
 * Moves module from one section to another
 */
export const tryMoveActivityModuleBetweenSections = Result.wrap(
    async (args: MoveActivityModuleBetweenSectionsArgs) => {
        const { payload, linkId, newSectionId, newOrder, user, req, overrideAccess = false } = args;

        if (!linkId) {
            throw new InvalidArgumentError("Link ID is required");
        }

        if (!newSectionId) {
            throw new InvalidArgumentError("New section ID is required");
        }

        const transactionID = await payload.db.beginTransaction();
        if (!transactionID) {
            throw new TransactionIdNotFoundError("Failed to begin transaction");
        }

        try {
            // Get the existing link
            const existingLink = await payload.findByID({
                collection: CourseActivityModuleLinks.slug,
                id: linkId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const courseId =
                typeof existingLink.course === "number" ? existingLink.course : existingLink.course.id;

            // Verify new section exists and belongs to same course
            const newSection = await payload.findByID({
                collection: CourseSections.slug,
                id: newSectionId,
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess: true,
            });

            const newSectionCourseId =
                typeof newSection.course === "number" ? newSection.course : newSection.course.id;

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
                    sort: "-order",
                    user,
                    req: req ? { ...req, transactionID } : { transactionID },
                    overrideAccess: true,
                });

                linkOrder = existingModules.docs.length > 0 ? existingModules.docs[0].order + 1 : 1;
            }

            // Update the link
            const updatedLink = await payload.update({
                collection: CourseActivityModuleLinks.slug,
                id: linkId,
                data: {
                    section: newSectionId,
                    order: linkOrder,
                },
                user,
                req: req ? { ...req, transactionID } : { transactionID },
                overrideAccess,
            });

            await payload.db.commitTransaction(transactionID);

            return updatedLink as CourseActivityModuleLink;
        } catch (error) {
            await payload.db.rollbackTransaction(transactionID);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to move activity module between sections", { cause: error }),
);

// ============================================================================
// Validation & Utilities
// ============================================================================

export interface ValidateNoCircularReferenceArgs {
    payload: Payload;
    sectionId: number;
    newParentSectionId: number;
    req?: Partial<PayloadRequest>;
}

export interface GetSectionModulesCountArgs {
    payload: Payload;
    sectionId: number;
    user?: User | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
}

/**
 * Ensures parent change won't create circular reference
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

        const section: any = await payload.findByID({
            collection: CourseSections.slug,
            id: currentId,
            depth: 0,
            req,
            overrideAccess: true,
        });

        currentId =
            typeof section.parentSection === "number"
                ? section.parentSection
                : section.parentSection?.id ?? null;
    }

    return false; // No circular reference
}

/**
 * Helper function to get all nested sections recursively
 */
async function getSectionDescendants(
    payload: Payload,
    sectionId: number,
    req?: Partial<PayloadRequest>,
): Promise<CourseSection[]> {
    const descendants: CourseSection[] = [];

    const childSections = await payload.find({
        collection: CourseSections.slug,
        where: {
            parentSection: {
                equals: sectionId,
            },
        },
        sort: "order",
        pagination: false,
        depth: 0,
        req,
        overrideAccess: true,
    });

    for (const child of childSections.docs) {
        descendants.push(child as CourseSection);
        // Recursively get descendants of this child
        const childDescendants = await getSectionDescendants(payload, child.id, req);
        descendants.push(...childDescendants);
    }

    return descendants;
}
