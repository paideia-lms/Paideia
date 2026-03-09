import { Payload } from "payload";

/**
 * Assignment Module
 * 
 * @upstream
 * - `courses`: Assignments are course activities and must be linked to existing courses
 * 
 * @downstream
 * - `gradebook`: Assignment grades are tracked in gradebooks
 * 
 * Provides assignment management functionality for courses.
 * Assignments are course activity modules that students can submit work.
 */
export class AssignmentModule {
    private readonly payload: Payload;
    public static readonly moduleName = "assignment" as const;
    public static readonly dependencies = ["courses"] as const;
    public static readonly collections = [];
    public static readonly cli = {};
    public static readonly search = [];
    public static readonly seedData = [];
    public static readonly queues = [];
    public static readonly tasks = [];
    public static readonly api = {};

    constructor(payload: Payload) {
        this.payload = payload;
    }
}