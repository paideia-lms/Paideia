import { createContext } from "react-router";
import type { CourseSection } from "server/payload-types";
import { Result } from "typescript-result";
import type { tryFindSectionById } from "../internal/course-section-management";
export { courseSectionContextKey } from "./utils/context-keys";
export type CourseSectionContext = {
	section: CourseSection;
};

/**
 * Context for a course section
 * Available when user is viewing or editing a section
 */
export const courseSectionContext =
	createContext<CourseSectionContext | null>();

/**
 * Get course section context for a section
 */
export async function tryGetCourseSectionContext(
	result: Awaited<ReturnType<typeof tryFindSectionById>>,
): Promise<Result<CourseSectionContext, Error>> {
	if (!result.ok) {
		return result;
	}

	return Result.ok({
		section: result.value,
	});
}
