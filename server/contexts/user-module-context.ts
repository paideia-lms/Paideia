import type { BasePayload } from "payload";
import { createContext } from "react-router";
import { Result } from "typescript-result";
import {
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	tryFindGrantsByActivityModule,
	tryFindInstructorsForActivityModule,
} from "../internal/activity-module-access";
import { tryGetActivityModuleById } from "../internal/activity-module-management";
import { tryFindLinksByActivityModule } from "../internal/course-activity-module-link-management";
import { tryFindCourseById } from "../internal/course-management";
import type { ActivityModule, Course, Quiz, User } from "../payload-types";

export type UserModuleUser = {
	id: number;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatar?:
		| number
		| {
				id: number;
				filename?: string;
		  }
		| null;
};

export type UserModuleAssignmentData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	allowLateSubmissions: boolean | null;
	requireTextSubmission: boolean | null;
	requireFileSubmission: boolean | null;
};

export type UserModuleQuizData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	points: number | null;
	timeLimit: number | null;
	gradingType: Quiz["gradingType"] | null;
};

export type UserModuleDiscussionData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
};

export type UserModule = {
	id: number;
	title: string;
	description: string | null;
	type: ActivityModule["type"];
	status: ActivityModule["status"];
	requirePassword: boolean | null;
	accessPassword: string | null;
	createdBy: UserModuleUser;
	owner: UserModuleUser;
	assignment: UserModuleAssignmentData | null;
	quiz: UserModuleQuizData | null;
	discussion: UserModuleDiscussionData | null;
	createdAt: string;
	updatedAt: string;
};

export type UserModuleGrant = {
	id: number;
	grantedTo: UserModuleUser;
	grantedBy: UserModuleUser;
	grantedAt: string;
};

export type Instructor = {
	id: number;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatar?:
		| number
		| {
				id: number;
				filename?: string;
		  }
		| null;
	enrollments: {
		courseId: number;
		role: "teacher" | "ta";
	}[];
};

export type UserModuleContext = {
	module: UserModule;
	linkedCourses: {
		id: number;
		title: string;
		slug: string;
		description: string | null;
		status: Course["status"];
		createdAt: string;
		updatedAt: string;
	}[];
	grants: UserModuleGrant[];
	instructors: Instructor[];
	links: ReturnType<typeof tryFindLinksByActivityModule>["$inferValue"];
};

export const userModuleContext = createContext<UserModuleContext | null>();

export const userModuleContextKey =
	"userModuleContext" as unknown as typeof userModuleContext;

/**
 * Get user module context for a given module ID
 * This includes the module data, linked courses, grants, and instructors
 */
export const tryGetUserModuleContext = Result.wrap(
	async (payload: BasePayload, moduleId: number, _currentUser: User | null) => {
		// Fetch the activity module
		const moduleResult = await tryGetActivityModuleById(payload, {
			id: moduleId,
		});

		if (!moduleResult.ok) {
			throw new NonExistingActivityModuleError("Activity module not found");
		}

		const module = moduleResult.value;

		const transformedModule = {
			id: module.id,
			title: module.title || "",
			description: module.description || null,
			type: module.type,
			status: module.status,
			requirePassword: module.requirePassword || null,
			accessPassword: module.accessPassword || null,
			createdBy: {
				id: module.createdBy.id,
				email: module.createdBy.email,
				firstName: module.createdBy.firstName ?? "",
				lastName: module.createdBy.lastName ?? "",
				avatar: module.createdBy.avatar ?? null,
			},
			owner: {
				id: module.owner.id,
				email: module.owner.email,
				firstName: module.owner.firstName ?? "",
				lastName: module.owner.lastName ?? "",
				avatar: module.owner.avatar ?? null,
			},
			assignment:
				module.type === "assignment" &&
				typeof module.assignment === "object" &&
				module.assignment !== null
					? {
							id: module.assignment.id,
							instructions: module.assignment.instructions || null,
							dueDate: module.assignment.dueDate || null,
							maxAttempts: module.assignment.maxAttempts || null,
							allowLateSubmissions:
								module.assignment.allowLateSubmissions || null,
							requireTextSubmission:
								module.assignment.requireTextSubmission || null,
							requireFileSubmission:
								module.assignment.requireFileSubmission || null,
						}
					: null,
			quiz:
				module.type === "quiz" &&
				typeof module.quiz === "object" &&
				module.quiz !== null
					? {
							id: module.quiz.id,
							instructions: module.quiz.instructions || null,
							dueDate: module.quiz.dueDate || null,
							maxAttempts: module.quiz.maxAttempts || null,
							points: module.quiz.points || null,
							timeLimit: module.quiz.timeLimit || null,
							gradingType: module.quiz.gradingType || null,
						}
					: null,
			discussion:
				module.type === "discussion" &&
				typeof module.discussion === "object" &&
				module.discussion !== null
					? {
							id: module.discussion.id,
							instructions: module.discussion.instructions || null,
							dueDate: module.discussion.dueDate || null,
							requireThread: module.discussion.requireThread || null,
							requireReplies: module.discussion.requireReplies || null,
							minReplies: module.discussion.minReplies || null,
						}
					: null,
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
		} satisfies UserModule;

		// Fetch linked courses with enrollments

		const linksResult = await tryFindLinksByActivityModule(payload, module.id);

		if (!linksResult.ok) throw linksResult.error;

		// unique course ids
		// const courseIds = linksResult.value.map(link => link.course.id).filter((id, index, self) => self.indexOf(id) === index);

		// // now the links are ok, use promise.all to fetch the courses
		// const courses = await Promise.all(courseIds.map(async (courseId) => {
		//     const courseResult = await tryFindCourseById({
		//         payload,
		//         courseId: courseId,
		//         user: _currentUser,
		//         overrideAccess: true,
		//     });
		//     if (!courseResult.ok) throw courseResult.error;
		//     return courseResult.value;
		// }));

		// Fetch grants
		const grantsResult = await tryFindGrantsByActivityModule({
			payload,
			activityModuleId: module.id,
		});
		const grants: UserModuleGrant[] = grantsResult.ok
			? grantsResult.value.map((grant) => ({
					id: grant.id,
					grantedTo: {
						id: grant.grantedTo.id,
						email: grant.grantedTo.email,
						firstName: grant.grantedTo.firstName ?? "",
						lastName: grant.grantedTo.lastName ?? "",
						avatar: grant.grantedTo.avatar ?? null,
					},
					grantedBy: {
						id: grant.grantedBy.id,
						email: grant.grantedBy.email,
						firstName: grant.grantedBy.firstName ?? "",
						lastName: grant.grantedBy.lastName ?? "",
						avatar: grant.grantedBy.avatar ?? null,
					},
					grantedAt: grant.grantedAt,
				}))
			: [];

		const instructorsResult = await tryFindInstructorsForActivityModule({
			payload,
			activityModuleId: module.id,
		});

		if (!instructorsResult.ok) throw instructorsResult.error;

		// Extract instructors from course enrollments
		const instructors = instructorsResult.value;

		// unique by course id
		const uniqueCourses = linksResult.value
			.map((link) => link.course)
			.filter(
				(course, index, self) =>
					self.findIndex((c) => c.id === course.id) === index,
			)
			.map((course) => ({
				id: course.id,
				title: course.title,
				slug: course.slug,
				description: course.description,
				status: course.status,
				createdAt: course.createdAt,
				updatedAt: course.updatedAt,
			}));

		return {
			module: transformedModule,
			linkedCourses: uniqueCourses,
			grants,
			instructors,
			links: linksResult.value,
		} satisfies UserModuleContext;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user module context", { cause: error }),
);
