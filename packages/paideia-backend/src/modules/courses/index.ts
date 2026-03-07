import { Payload } from "payload";
import { UserModule } from "../user";
import { Courses, CourseSections, CourseActivityModuleLinks } from "server/collections";



export namespace CoursesModule {

}

/**
 * Courses Module
 * 
 * @upstream
 * - `user`: Required for the `createdBy` relationship in the Courses collection (course creators/instructors).
 * - `infrastructure`: Required for cron jobs to process scheduled publishing and other automated tasks.
 * 
 * @downstream
 * - `enrolment`: Cannot enroll without an existing course.
 * - `gradebook`: Gradebooks are strictly bound to a Course ID.
 * - `pages`, `assignments`, `quizzes`, `discussions`, `files`: All course content modules require a course to exist.
 * - Activity modules: All activity types (assignments, quizzes, discussions) are linked to courses via CourseActivityModuleLinks.
 * 
 * Core course management module handling course creation, sections, and activity module linking.
 */
export class CoursesModule {
    private readonly payload: Payload;
    public static readonly moduleName = "courses" as const;
    public static readonly dependencies = ["user", "infrastructure"] as const;
    public static readonly collections = [Courses, CourseSections, CourseActivityModuleLinks];
    public static readonly cli = {};
    public static readonly search = [
        Courses.slug,
    ];
    public static readonly seedData = {

    };
    public static readonly queues = [];
    public static readonly tasks = [];

    constructor(payload: Payload) {
        this.payload = payload;
    }
}