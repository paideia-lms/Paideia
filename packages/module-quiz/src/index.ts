import type { Payload } from "payload";
import packageJson from "../package.json";
import { Quizzes } from "./collections/quizzes";
import { QuizSubmissions } from "./collections/quiz-submissions";

/**
 * Quiz Module
 *
 * @upstream
 * - `@paideia/module-course`: Quizzes are course activities
 * - `@paideia/module-user`: Required for student, createdBy, gradedBy relationships
 * - `@paideia/module-enrolment`: Required for enrollment relationship in submissions
 *
 * @downstream
 * - `@paideia/module-grading`: Quiz grades are tracked in gradebooks
 */
export class QuizModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Quizzes, QuizSubmissions];
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
