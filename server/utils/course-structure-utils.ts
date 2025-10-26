import type {
    CourseStructure,
    CourseStructureItem,
    CourseStructureSection,
} from "../internal/course-section-management";

/**
 * Flattens a course structure into a sequential list of module link IDs
 * Uses depth-first traversal to maintain the order users see in the UI
 */
export function flattenCourseStructure(courseStructure: CourseStructure): number[] {
    const moduleLinkIds: number[] = [];

    function traverseSection(
        content: (CourseStructureItem | CourseStructureSection)[],
    ): void {
        for (const item of content) {
            if (item.type === "activity-module") {
                moduleLinkIds.push(item.id);
            } else if (item.type === "section") {
                traverseSection(item.content);
            }
        }
    }

    for (const section of courseStructure.sections) {
        traverseSection(section.content);
    }

    return moduleLinkIds;
}

