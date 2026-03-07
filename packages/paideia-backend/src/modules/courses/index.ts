import { Payload } from "payload";
import { UserModule } from "../user";
import { Courses, CourseSections, CourseActivityModuleLinks } from "server/collections";


export namespace CoursesModule {

}

/** 
 * this is the single point of export for the courses module.
 * 
 * it is responsible for managing the courses collection and the related collections.
 */
export class CoursesModule {
    private readonly payload: Payload;
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