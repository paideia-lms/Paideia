import type {
	CourseStructure,
	CourseStructureItem,
	CourseStructureSection,
} from "../internal/course-section-management";
import type { ActivityModule } from "../payload-types";

export type FlattenedModule = {
	moduleLinkId: number;
	title: string;
	type: ActivityModule["type"];
};

/**
 * Flattens a course structure into a sequential list of modules with their info
 * Uses depth-first traversal to maintain the order users see in the UI
 */
export function flattenCourseStructureWithModuleInfo(
	courseStructure: CourseStructure,
): FlattenedModule[] {
	const modules: FlattenedModule[] = [];

	function traverseSection(
		content: (CourseStructureItem | CourseStructureSection)[],
	): void {
		for (const item of content) {
			if (item.type === "activity-module") {
				modules.push({
					moduleLinkId: item.id,
					title: item.module.title,
					type: item.module.type,
				});
			} else if (item.type === "section") {
				traverseSection(item.content);
			}
		}
	}

	for (const section of courseStructure.sections) {
		traverseSection(section.content);
	}

	return modules;
}
