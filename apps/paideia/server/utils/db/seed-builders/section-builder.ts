import type { SeedData } from "../seed-schema";
import { tryCreateSection } from "../../../internal/course-section-management";
import { tryCreateCourseActivityModuleLink } from "../../../internal/course-activity-module-link-management";
import { seedLogger } from "../seed-utils/logger";
import type { SeedContext } from "./user-builder";
import type { ActivityModuleResult } from "../../../internal/activity-module-management";

type Section = Awaited<ReturnType<typeof tryCreateSection>>["value"];

export interface CreatedSections {
	sections: Section[];
	links: Awaited<
		ReturnType<typeof tryCreateCourseActivityModuleLink>
	>["value"][];
}

/**
 * Creates all course sections for seeding
 */
export async function buildSections(
	ctx: SeedContext,
	data: SeedData,
	courseId: number,
): Promise<Section[]> {
	seedLogger.section("Creating Course Sections");

	const sections: Section[] = [];

	for (const sectionData of data.sections) {
		const section = await tryCreateSection({
			payload: ctx.payload,
			req: ctx.req,
			data: {
				course: courseId,
				title: sectionData.title,
				description: sectionData.description,
			},
			overrideAccess: true,
		}).getOrThrow();

		sections.push(section);
		seedLogger.success(`Course section created with ID: ${section.id}`);
	}

	return sections;
}

/**
 * Links modules to course sections
 */
export async function buildModuleLinks(
	ctx: SeedContext,
	courseId: number,
	modules: ActivityModuleResult[],
	sections: Section[],
): Promise<
	Awaited<ReturnType<typeof tryCreateCourseActivityModuleLink>>["value"][]
> {
	seedLogger.section("Linking Modules to Sections");

	if (sections.length === 0) {
		throw new Error(
			"No sections were created, cannot link modules to sections",
		);
	}

	const links: Awaited<
		ReturnType<typeof tryCreateCourseActivityModuleLink>
	>["value"][] = [];

	for (let i = 0; i < modules.length; i++) {
		const module = modules[i];
		if (!module) continue;

		const sectionIndex = i % sections.length;
		const section = sections[sectionIndex];
		if (!section) continue;

		const link = await tryCreateCourseActivityModuleLink({
			payload: ctx.payload,
			req: ctx.req,
			course: courseId,
			activityModule: module.id,
			section: section.id,
			order: Math.floor(i / sections.length),
			overrideAccess: true,
		}).getOrThrow();

		links.push(link);
		seedLogger.success(`Module linked to section (ID: ${link.id})`);
	}

	return links;
}
