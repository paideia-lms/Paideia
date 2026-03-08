import packageJson from "../package.json";
import { Payload } from "payload";
import { UserModule } from "@paideia/module-user";
import { Courses } from "./collections/courses";
import { CourseSections } from "./collections/course-sections";
import {
	trySeedCourses,
	type TrySeedCoursesArgs,
	type SeedCoursesResult,
} from "./seeding/courses-builder";
import {
	trySeedCourseSections,
	type TrySeedCourseSectionsArgs,
	type SeedCourseSectionsResult,
} from "./seeding/course-sections-builder";

export namespace CourseModule {
	export type Collections = typeof CourseModule.collections;
	export type SeedCoursesResult = import("./seeding/courses-builder").SeedCoursesResult;
	export type SeedCourseSectionsResult =
		import("./seeding/course-sections-builder").SeedCourseSectionsResult;
}

/**
 * Course Module
 *
 * Manages courses and course sections. Does not manage enrollments, gradebooks, groups, or categories
 * — those are handled by other modules.
 *
 * @upstream
 * - `user`: Required for the `createdBy` relationship in the Courses collection (course creators/instructors).
 * - `infrastructure`: Required for cron jobs to process scheduled publishing and other automated tasks.
 *
 * @downstream
 * - `enrolment`, `gradebook`, `pages`, `assignments`, `quizzes`, `discussions`, `files`: All require a course to exist.
 */
export class CourseModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(
		packageJson.dependencies as Record<string, string>,
	);
	public static readonly collections = [Courses, CourseSections];
	public static readonly cli = {};
	public static readonly search = [Courses.slug];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];

	constructor(payload: Payload) {
		this.payload = payload;
	}

	async seedCourses(args: Omit<TrySeedCoursesArgs, "payload">) {
		return trySeedCourses({
			payload: this.payload,
			...args,
		});
	}

	async seedCourseSections(args: Omit<TrySeedCourseSectionsArgs, "payload">) {
		return trySeedCourseSections({
			payload: this.payload,
			...args,
		});
	}
}
