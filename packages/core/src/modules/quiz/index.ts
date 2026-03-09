import { Payload } from "payload";

/**
 * Quiz Module
 * 
 * @upstream
 * - `courses`: Quizzes are course activities and must be linked to existing courses
 * 
 * @downstream
 * - `gradebook`: Quiz grades are tracked in gradebooks
 * 
 * Provides quiz management functionality for courses.
 * Quizzes are course activity modules with questions, automated grading, and multiple attempt support.
 */
export class QuizModule {
    private readonly payload: Payload;
    public static readonly moduleName = "quiz" as const;
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