import { Payload } from "payload";
import { Enrollments } from "server/collections";
import { Groups } from "server/collections";

/**
 * Enrolment Module
 * 
 * @upstream
 * - `courses`: Cannot enroll without an existing course
 * 
 * @downstream
 * - `gradebook`: Gradebooks are created for course enrolments
 * - `grading`: Grading is tied to enrolments
 * 
 * Provides course enrollment management functionality.
 * Students enroll in courses with specific roles (student, teacher, TA).
 */
export class EnrolmentModule {
    private readonly payload: Payload;
    public static readonly moduleName = "enrolment" as const;
    public static readonly dependencies = ["courses"] as const;
    public static readonly collections = [
        Enrollments,
        Groups,
    ];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = {};
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};

    constructor(payload: Payload) {
        this.payload = payload;
    }
}
