import { createContext } from "react-router";
import { Result } from "typescript-result";
import { InvalidArgumentError } from "../../app/utils/error";
import type { PaideiaContextArgs } from "./global-context";
export { courseSectionContextKey } from "./utils/context-keys";

export type CourseSectionContext = NonNullable<
	Awaited<ReturnType<typeof tryGetCourseSectionContext>>["value"]
>;
export const courseSectionContext = createContext<CourseSectionContext | null>(
	null,
);

export interface TryGetCourseSectionContextArgs extends PaideiaContextArgs {
	sectionId: number;
}

export async function tryGetCourseSectionContext(
	args: TryGetCourseSectionContextArgs,
) {
	const { paideia, req, sectionId, overrideAccess } = args;
	if (Number.isNaN(sectionId)) {
		return Result.error(new InvalidArgumentError("Section ID is required"));
	}
	const sectionResult = await paideia.tryFindSectionById({
		sectionId: sectionId,
		req,
		overrideAccess,
	});

	return sectionResult;
}
