import type { Course } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "@paideia/shared";
import { UnknownError } from "../errors";
import type { BaseInternalFunctionArgs } from "@paideia/shared";
import { tryCreateCourse } from "../services/course-management";
import type { CourseSeedData } from "./course-seed-schema";

export interface TrySeedCoursesArgs extends BaseInternalFunctionArgs {
	data: CourseSeedData;
	usersByEmail: Map<string, User>;
	mediaByFilename?: Map<string, { id: number }>;
}

export interface SeedCoursesResult {
	courses: Course[];
	coursesBySlug: Map<string, Course>;
	getCourseBySlug: (slug: string) => Course | undefined;
}

class CoursesSeedBuilder extends SeedBuilder<
	CourseSeedData["courses"][number],
	Course
> {
	readonly entityName = "course";
	private usersByEmail: Map<string, User>;
	private mediaByFilename?: Map<string, { id: number }>;

	constructor(
		usersByEmail: Map<string, User>,
		mediaByFilename?: Map<string, { id: number }>,
	) {
		super();
		this.usersByEmail = usersByEmail;
		this.mediaByFilename = mediaByFilename;
	}

	protected async seedEntities(
		inputs: CourseSeedData["courses"][number][],
		context: SeedContext,
	): Promise<Course[]> {
		const result: Course[] = [];

		for (const input of inputs) {
			const user = this.usersByEmail.get(input.createdByEmail);
			if (!user) {
				throw new UnknownError(
					`User not found for email: ${input.createdByEmail}. Seed users first.`,
				);
			}

			const thumbnail = input.thumbnailFilename
				? this.mediaByFilename?.get(input.thumbnailFilename)?.id
				: undefined;

			const course = (await tryCreateCourse({
				payload: context.payload,
				data: {
					title: input.title,
					slug: input.slug,
					description: input.description,
					status: input.status,
					createdBy: user.id,
					thumbnail,
					tags: input.tags?.map((tag) => ({ tag })),
				},
				req: context.req,
				overrideAccess: context.overrideAccess,
			}).getOrThrow()) as unknown as Course;

			result.push(course);
		}

		return result;
	}
}

export function trySeedCourses(args: TrySeedCoursesArgs) {
	const builder = new CoursesSeedBuilder(
		args.usersByEmail,
		args.mediaByFilename,
	);

	return builder
		.trySeed({
			payload: args.payload,
			req: args.req,
			overrideAccess: args.overrideAccess,
			data: { inputs: args.data.courses },
		})
		.map((courses) => {
			const coursesBySlug = new Map<string, Course>();
			for (const course of courses) {
				coursesBySlug.set(course.slug, course);
			}

			return {
				courses,
				coursesBySlug,
				getCourseBySlug: (slug: string) => coursesBySlug.get(slug),
			};
		});
}
