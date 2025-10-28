import type { BasePayload } from "payload";
import { createContext } from "react-router";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import { Result } from "typescript-result";
import {
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryFindCourseActivityModuleLinkById } from "../internal/course-activity-module-link-management";
import { tryGetCourseStructure } from "../internal/course-section-management";
import type { ActivityModule, User } from "../payload-types";
import { flattenCourseStructure } from "../utils/course-structure-utils";

export type CourseModuleUser = {
	id: number;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatar?:
	| number
	| {
		id: number;
		filename?: string | null;
	}
	| null;
};

export type CourseModulePageData = {
	id: number;
	content: string | null;
};

export type CourseModuleWhiteboardData = {
	id: number;
	content: string | null;
};

export type CourseModuleAssignmentData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	allowLateSubmissions: boolean | null;
	requireTextSubmission: boolean | null;
	requireFileSubmission: boolean | null;
};

export type CourseModuleQuizData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	points: number | null;
	timeLimit: number | null;
	gradingType: "automatic" | "manual" | null;
	rawQuizConfig: QuizConfig | null;
};

export type CourseModuleDiscussionData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
};

export type CourseModule = {
	id: number;
	title: string;
	description: string | null;
	type: ActivityModule["type"];
	status: ActivityModule["status"];
	createdBy: CourseModuleUser;
	owner: CourseModuleUser;
	page: CourseModulePageData | null;
	whiteboard: CourseModuleWhiteboardData | null;
	assignment: CourseModuleAssignmentData | null;
	quiz: CourseModuleQuizData | null;
	discussion: CourseModuleDiscussionData | null;
	createdAt: string;
	updatedAt: string;
};

export type CourseModuleContext = {
	module: CourseModule;
	moduleLinkId: number;
	moduleLinkCreatedAt: string;
	moduleLinkUpdatedAt: string;
	previousModuleLinkId: number | null;
	nextModuleLinkId: number | null;
};

export const courseModuleContext = createContext<CourseModuleContext | null>(
	null,
);

export const courseModuleContextKey =
	"courseModuleContext" as unknown as typeof courseModuleContext;

/**
 * Get course module context for a given module link ID
 * This includes the full module data and next/previous navigation
 */
export const tryGetCourseModuleContext = Result.wrap(
	async (
		payload: BasePayload,
		moduleLinkId: number,
		courseId: number,
		currentUser: User | null,
	) => {
		// Fetch the module link
		const moduleLinkResult = await tryFindCourseActivityModuleLinkById(
			payload,
			moduleLinkId,
		);

		if (!moduleLinkResult.ok) {
			throw new NonExistingActivityModuleError("Module link not found");
		}

		const moduleLink = moduleLinkResult.value;

		// Get the activity module ID
		const activityModuleId =
			typeof moduleLink.activityModule === "number"
				? moduleLink.activityModule
				: moduleLink.activityModule.id;

		// Fetch full activity module with depth 2
		const activityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
			depth: 2,
			overrideAccess: true,
		});

		// Transform module data
		const transformedModule: CourseModule = {
			id: activityModule.id,
			title: activityModule.title || "",
			description: activityModule.description || null,
			type: activityModule.type,
			status: activityModule.status,
			createdBy: {
				id:
					typeof activityModule.createdBy === "number"
						? activityModule.createdBy
						: activityModule.createdBy.id,
				email:
					typeof activityModule.createdBy === "number"
						? ""
						: activityModule.createdBy.email,
				firstName:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.firstName ?? null),
				lastName:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.lastName ?? null),
				avatar:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.avatar ?? null),
			},
			owner: {
				id:
					typeof activityModule.owner === "number"
						? activityModule.owner
						: activityModule.owner.id,
				email:
					typeof activityModule.owner === "number"
						? ""
						: activityModule.owner.email,
				firstName:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.firstName ?? null),
				lastName:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.lastName ?? null),
				avatar:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.avatar ?? null),
			},
			page:
				activityModule.type === "page" &&
					typeof activityModule.page === "object" &&
					activityModule.page !== null
					? {
						id: activityModule.page.id,
						content: activityModule.page.content || null,
					}
					: null,
			whiteboard:
				activityModule.type === "whiteboard" &&
					typeof activityModule.whiteboard === "object" &&
					activityModule.whiteboard !== null
					? {
						id: activityModule.whiteboard.id,
						content: activityModule.whiteboard.content || null,
					}
					: null,
			assignment:
				activityModule.type === "assignment" &&
					typeof activityModule.assignment === "object" &&
					activityModule.assignment !== null
					? {
						id: activityModule.assignment.id,
						instructions: activityModule.assignment.instructions || null,
						dueDate: activityModule.assignment.dueDate || null,
						maxAttempts: activityModule.assignment.maxAttempts || null,
						allowLateSubmissions:
							activityModule.assignment.allowLateSubmissions || null,
						requireTextSubmission:
							activityModule.assignment.requireTextSubmission || null,
						requireFileSubmission:
							activityModule.assignment.requireFileSubmission || null,
					}
					: null,
			quiz:
				activityModule.type === "quiz" &&
					typeof activityModule.quiz === "object" &&
					activityModule.quiz !== null
					? {
						id: activityModule.quiz.id,
						instructions: activityModule.quiz.instructions || null,
						dueDate: activityModule.quiz.dueDate || null,
						maxAttempts: activityModule.quiz.maxAttempts || null,
						points: activityModule.quiz.points || null,
						timeLimit: activityModule.quiz.timeLimit || null,
						gradingType: activityModule.quiz.gradingType || null,
						rawQuizConfig: activityModule.quiz
							.rawQuizConfig as unknown as QuizConfig | null,
					}
					: null,
			discussion:
				activityModule.type === "discussion" &&
					typeof activityModule.discussion === "object" &&
					activityModule.discussion !== null
					? {
						id: activityModule.discussion.id,
						instructions: activityModule.discussion.instructions || null,
						dueDate: activityModule.discussion.dueDate || null,
						requireThread: activityModule.discussion.requireThread || null,
						requireReplies: activityModule.discussion.requireReplies || null,
						minReplies: activityModule.discussion.minReplies || null,
					}
					: null,
			createdAt: activityModule.createdAt,
			updatedAt: activityModule.updatedAt,
		};

		// Get course structure to determine next/previous modules
		const courseStructureResult = await tryGetCourseStructure({
			payload,
			courseId,
			user: currentUser
				? {
					...currentUser,
					avatar: currentUser?.avatar
						? typeof currentUser.avatar === "number"
							? currentUser.avatar
							: currentUser.avatar.id
						: undefined,
				}
				: null,
			overrideAccess: false,
		});

		if (!courseStructureResult.ok) {
			throw courseStructureResult.error;
		}

		// Flatten course structure to get sequential list of module link IDs
		const flatModuleLinkIds = flattenCourseStructure(
			courseStructureResult.value,
		);

		// Find current position and determine next/previous
		const currentIndex = flatModuleLinkIds.indexOf(moduleLinkId);
		const previousModuleLinkId =
			currentIndex > 0 ? flatModuleLinkIds[currentIndex - 1] : null;
		const nextModuleLinkId =
			currentIndex < flatModuleLinkIds.length - 1
				? flatModuleLinkIds[currentIndex + 1]
				: null;

		return {
			module: transformedModule,
			moduleLinkId: moduleLink.id,
			moduleLinkCreatedAt: moduleLink.createdAt,
			moduleLinkUpdatedAt: moduleLink.updatedAt,
			previousModuleLinkId,
			nextModuleLinkId,
		} satisfies CourseModuleContext;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get course module context", { cause: error }),
);
