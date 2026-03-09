import type { Payload } from "payload";
import packageJson from "../package.json";
import { Gradebooks } from "./collections/gradebooks";
import { GradebookCategories } from "./collections/gradebook-categories";
import { GradebookItems } from "./collections/gradebook-items";
import { UserGrades } from "./collections/user-grades";
import { CourseGradeTables } from "./collections/course-grade-tables";

/**
 * Grading Module
 *
 * @upstream
 * - `@paideia/module-user`: Required for gradedBy, appliedBy relationships
 * - `@paideia/module-course`: Required for course relationship in gradebooks
 * - `@paideia/module-enrolment`: Required for enrollment relationship in user-grades
 *
 * @downstream
 * - `@paideia/module-assignment`: Assignment submissions link to gradebook items
 * - `@paideia/module-quiz`: Quiz submissions link to gradebook items
 * - `@paideia/module-discussion`: Discussion submissions link to gradebook items
 */
export class GradingModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(packageJson.dependencies);
	public static readonly collections = [
		Gradebooks,
		GradebookCategories,
		GradebookItems,
		UserGrades,
		CourseGradeTables,
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
