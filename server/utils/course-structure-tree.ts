import type {
	CourseStructure,
	CourseStructureItem,
	CourseStructureSection,
} from "../internal/course-section-management";

/**
 * Generates a plain text tree representation from a course structure
 * @param courseStructure The course structure to convert to tree format
 * @param courseTitle Optional course title to display at the root
 * @returns Plain text tree representation
 */
export function generateCourseStructureTree(
	courseStructure: CourseStructure,
	courseTitle?: string,
): string {
	const lines: string[] = [];

	// Add course title or default
	const title = courseTitle || `Course ${courseStructure.courseId}`;
	lines.push(title);

	// Generate tree for each root section
	for (let i = 0; i < courseStructure.sections.length; i++) {
		const section = courseStructure.sections[i];
		const isLast = i === courseStructure.sections.length - 1;

		generateSectionTree(section, "", isLast, lines);
	}

	return lines.join("\n");
}

/**
 * Recursively generates tree representation for a section and its content
 */
function generateSectionTree(
	section: CourseStructureSection,
	prefix: string,
	isLast: boolean,
	lines: string[],
): void {
	// Generate section line
	const connector = isLast ? "└── " : "├── ";
	const sectionLine = `${prefix}${connector}${section.title} (contentOrder: ${section.contentOrder})`;
	lines.push(sectionLine);

	// Generate content tree
	const newPrefix = prefix + (isLast ? "    " : "│   ");

	for (let i = 0; i < section.content.length; i++) {
		const item = section.content[i];
		const isLastItem = i === section.content.length - 1;

		if (item.type === "activity-module") {
			generateActivityModuleTree(item, newPrefix, isLastItem, lines);
		} else if (item.type === "section") {
			generateSectionTree(item, newPrefix, isLastItem, lines);
		}
	}
}

/**
 * Generates tree representation for an activity module
 */
function generateActivityModuleTree(
	item: CourseStructureItem,
	prefix: string,
	isLast: boolean,
	lines: string[],
): void {
	const connector = isLast ? "└── " : "├── ";
	const moduleLine = `${prefix}${connector}Activity Module ${item.id} (contentOrder: ${item.contentOrder})`;
	lines.push(moduleLine);
}

/**
 * Generates a simplified tree representation without order information
 * @param courseStructure The course structure to convert to tree format
 * @param courseTitle Optional course title to display at the root
 * @returns Simplified plain text tree representation
 */
export function generateSimpleCourseStructureTree(
	courseStructure: CourseStructure,
	courseTitle?: string,
): string {
	const lines: string[] = [];

	// Add course title or default
	const title = courseTitle || `Course ${courseStructure.courseId}`;
	lines.push(title);

	// Generate tree for each root section
	for (let i = 0; i < courseStructure.sections.length; i++) {
		const section = courseStructure.sections[i];
		const isLast = i === courseStructure.sections.length - 1;

		generateSimpleSectionTree(section, "", isLast, lines);
	}

	return lines.join("\n");
}

/**
 * Recursively generates simplified tree representation for a section and its content
 */
function generateSimpleSectionTree(
	section: CourseStructureSection,
	prefix: string,
	isLast: boolean,
	lines: string[],
): void {
	// Generate section line
	const connector = isLast ? "└── " : "├── ";
	const sectionLine = `${prefix}${connector}${section.title}`;
	lines.push(sectionLine);

	// Generate content tree
	const newPrefix = prefix + (isLast ? "    " : "│   ");

	for (let i = 0; i < section.content.length; i++) {
		const item = section.content[i];
		const isLastItem = i === section.content.length - 1;

		if (item.type === "activity-module") {
			generateSimpleActivityModuleTree(item, newPrefix, isLastItem, lines);
		} else if (item.type === "section") {
			generateSimpleSectionTree(item, newPrefix, isLastItem, lines);
		}
	}
}

/**
 * Generates simplified tree representation for an activity module
 */
function generateSimpleActivityModuleTree(
	item: CourseStructureItem,
	prefix: string,
	isLast: boolean,
	lines: string[],
): void {
	const connector = isLast ? "└── " : "├── ";
	const moduleLine = `${prefix}${connector}Activity Module ${item.id}`;
	lines.push(moduleLine);
}
