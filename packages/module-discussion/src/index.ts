import type { Payload } from "payload";
import packageJson from "../package.json";
import { Discussions } from "./collections/discussions";
import { DiscussionSubmissions } from "./collections/discussion-submissions";

/**
 * Discussion Module
 *
 * @upstream
 * - `@paideia/module-course`: Discussions are course activities
 * - `@paideia/module-user`: Required for student, createdBy, gradedBy relationships
 * - `@paideia/module-enrolment`: Required for enrollment relationship in submissions
 *
 * @downstream
 * - `@paideia/module-grading`: Discussion grades are tracked in gradebooks
 */
export class DiscussionModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [Discussions, DiscussionSubmissions];
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
