import packageJson from "../package.json";
import type { Payload } from "payload";
import { Assignments } from "./collections/assignments";
import { AssignmentSubmissions } from "./collections/assignment-submissions";
import {
	tryCreateAssignment,
	tryUpdateAssignment,
	tryFindAssignmentById,
	tryListAssignmentsByCourse,
	tryDeleteAssignment,
	trySubmitAssignment,
	tryGradeSubmission,
	tryListSubmissions,
	tryFindSubmissionById,
	tryDeleteSubmission,
	type CreateAssignmentArgs,
	type SubmitAssignmentArgs,
	type GradeSubmissionArgs,
} from "./services/assignment-management";
import {
	trySeedAssignments,
	type TrySeedAssignmentsArgs,
	type SeedAssignmentsResult,
} from "./seeding/assignments-builder";
import * as api from "./api/assignment-management";

export namespace AssignmentModule {
	export type Collections = typeof AssignmentModule.collections;
	export type SeedAssignmentsResult = import("./seeding/assignments-builder").SeedAssignmentsResult;
}

/**
 * Assignment Module
 *
 * Manages assignments and assignment submissions within courses.
 *
 * @upstream
 * - `@paideia/module-user`: Required for student, createdBy, gradedBy relationships.
 * - `@paideia/module-course`: Required for course and section relationships.
 *
 * @downstream
 * - `@paideia/module-grading`: Assignment grades feed into gradebooks.
 */
export class AssignmentModule {
	private readonly payload: Payload;
	public static readonly moduleName = packageJson.name;
	public static readonly dependencies = Object.keys(
		packageJson.dependencies as Record<string, string>,
	);
	public static readonly collections = [Assignments, AssignmentSubmissions];
	public static readonly cli = {};
	public static readonly search = [Assignments.slug];
	public static readonly seedData = {};
	public static readonly queues = [];
	public static readonly tasks = [];
	public static readonly api = {
		createAssignment: api.createAssignment,
		updateAssignment: api.updateAssignment,
		findAssignmentById: api.findAssignmentById,
		listAssignmentsByCourse: api.listAssignmentsByCourse,
		deleteAssignment: api.deleteAssignment,
		submitAssignment: api.submitAssignment,
		gradeSubmission: api.gradeSubmission,
		listSubmissions: api.listSubmissions,
		findSubmissionById: api.findSubmissionById,
		deleteSubmission: api.deleteSubmission,
	};

	constructor(payload: Payload) {
		this.payload = payload;
	}

	async createAssignment(args: Omit<CreateAssignmentArgs, "payload">) {
		return tryCreateAssignment({ payload: this.payload, ...args });
	}

	async submitAssignment(args: Omit<SubmitAssignmentArgs, "payload">) {
		return trySubmitAssignment({ payload: this.payload, ...args });
	}

	async gradeSubmission(args: Omit<GradeSubmissionArgs, "payload">) {
		return tryGradeSubmission({ payload: this.payload, ...args });
	}

	async seedAssignments(args: Omit<TrySeedAssignmentsArgs, "payload">) {
		return trySeedAssignments({ payload: this.payload, ...args });
	}
}
