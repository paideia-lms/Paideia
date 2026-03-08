import type { CourseSection } from "payload-types";
import type { Course } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "../errors";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateSection } from "../services/course-section-management";
import type { CourseSectionSeedData } from "./course-section-seed-schema";

export interface TrySeedCourseSectionsArgs extends BaseInternalFunctionArgs {
	data: CourseSectionSeedData;
	coursesBySlug: Map<string, Course>;
}

export interface SeedCourseSectionsResult {
	sections: CourseSection[];
	sectionsByTitle: Map<string, CourseSection>;
	getSectionByTitle: (title: string) => CourseSection | undefined;
}

class CourseSectionsSeedBuilder extends SeedBuilder<
	CourseSectionSeedData["sections"][number],
	CourseSection
> {
	readonly entityName = "course-section";
	private coursesBySlug: Map<string, Course>;

	constructor(coursesBySlug: Map<string, Course>) {
		super();
		this.coursesBySlug = coursesBySlug;
	}

	protected async seedEntities(
		inputs: CourseSectionSeedData["sections"][number][],
		context: SeedContext,
	): Promise<CourseSection[]> {
		const result: CourseSection[] = [];
		const sectionsByTitle = new Map<string, CourseSection>();

		for (const input of inputs) {
			const course = this.coursesBySlug.get(input.courseSlug);
			if (!course) {
				throw new UnknownError(
					`Course not found for slug: ${input.courseSlug}. Seed courses first.`,
				);
			}

			const parentSection = input.parentSectionTitle
				? sectionsByTitle.get(input.parentSectionTitle)?.id
				: undefined;

			const section = (await tryCreateSection({
				payload: context.payload,
				data: {
					course: course.id,
					title: input.title,
					description: input.description,
					parentSection,
					contentOrder: input.contentOrder,
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow()) as unknown as CourseSection;

			result.push(section);
			sectionsByTitle.set(input.title, section);
		}

		return result;
	}
}

export function trySeedCourseSections(args: TrySeedCourseSectionsArgs) {
	const builder = new CourseSectionsSeedBuilder(args.coursesBySlug);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.sections },
		})
		.map((sections) => {
			const sectionsByTitle = new Map<string, CourseSection>();
			for (const section of sections) {
				sectionsByTitle.set(section.title, section);
			}

			return {
				sections,
				sectionsByTitle,
				getSectionByTitle: (title: string) => sectionsByTitle.get(title),
			};
		});
}
