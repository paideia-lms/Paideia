import { createContext } from "react-router";
import type { CourseSection } from "server/payload-types";
import { Result } from "typescript-result";
import { tryFindSectionById } from "../internal/course-section-management";
export { courseSectionContextKey } from "./utils/context-keys";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";

/**
 * CourseSectionContext is the resolved data for a course section,
 * available when user is viewing or editing a section.
 */
export type CourseSectionContext = NonNullable<
	Awaited<ReturnType<typeof tryGetCourseSectionContext>>["value"]
>;
export const courseSectionContext = createContext<CourseSectionContext | null>(
	null,
);

export interface TryGetCourseSectionContextArgs
	extends BaseInternalFunctionArgs {
	sectionId: number;
}

/**
 * Get course section context for a section.
 */
export async function tryGetCourseSectionContext(
	args: TryGetCourseSectionContextArgs,
) {
	const { payload, req, sectionId, overrideAccess } = args;
	// Always pass overrideAccess: false and provide current user
	const sectionResult = await tryFindSectionById({
		payload,
		sectionId: Number(sectionId),
		req,
		overrideAccess,
	});

	return sectionResult;
}
