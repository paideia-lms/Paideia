import type { BasePayload, PayloadRequest, TypedUser } from "payload";
import { createContext } from "react-router";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
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

export type UserModulePageData = {
	id: number;
	content: string | null;
};

export type UserModuleWhiteboardData = {
	id: number;
	content: string | null;
};

export type UserModuleAssignmentData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	allowLateSubmissions: boolean | null;
	requireTextSubmission: boolean | null;
	requireFileSubmission: boolean | null;
	allowedFileTypes: Array<{ extension: string; mimeType: string }> | null;
	maxFileSize: number | null;
	maxFiles: number | null;
};

export type UserModuleQuizData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	points: number | null;
	timeLimit: number | null;
	gradingType: Quiz["gradingType"] | null;
	rawQuizConfig: QuizConfig | null;
};

export type UserModuleDiscussionData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
};

export type UserModuleFileData = {
	id: number;
	media: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}> | null;
};

export type UserModule = {
	id: number;
	title: string;
	description: string | null;
	type: ActivityModule["type"];
	status: ActivityModule["status"];
	createdBy: UserModuleUser;
	owner: UserModuleUser;
	page: UserModulePageData | null;
	whiteboard: UserModuleWhiteboardData | null;
	file: UserModuleFileData | null;
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
	accessType: "owned" | "granted" | "readonly";
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
	async (
		payload: BasePayload,
		moduleId: number,
		currentUser: TypedUser | null,
		req?: Partial<PayloadRequest>,
	) => {
		// Fetch the activity module
		const moduleResult = await tryGetActivityModuleById({
			payload,
			id: moduleId,
			user: currentUser,
			req,
		});

		if (!moduleResult.ok) {
			throw new NonExistingActivityModuleError("Activity module not found");
		}

		const module = moduleResult.value;

		// Fetch media data if this is a file module
		let enrichedMedia: Array<{
			id: number;
			filename?: string | null;
			mimeType?: string | null;
			filesize?: number | null;
		}> | null = null;

		if (
			module.type === "file" &&
			module.media &&
			Array.isArray(module.media) &&
			module.media.length > 0
		) {
			try {
				const mediaResult = await payload.find({
					collection: "media",
					where: {
						id: {
							in: module.media,
						},
					},
					limit: module.media.length,
					user: currentUser,
					req,
					depth: 0,
					overrideAccess: false,
				});

				enrichedMedia = mediaResult.docs.map((media) => ({
					id: media.id,
					filename: media.filename ?? null,
					mimeType: media.mimeType ?? null,
					filesize: media.filesize ?? null,
				}));
			} catch (error) {
				console.error("Failed to fetch media data:", error);
				// Continue with null if fetch fails
			}
		}

		const transformedModule = {
			id: module.id,
			title: module.title || "",
			description: module.description || null,
			type: module.type,
			status: module.status,
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
			page:
				module.type === "page"
					? {
							id: module.id,
							content: module.content || null,
						}
					: null,
			whiteboard:
				module.type === "whiteboard"
					? {
							id: module.id,
							content: module.content || null,
						}
					: null,
			file:
				module.type === "file"
					? {
							id: module.id,
							media: enrichedMedia,
						}
					: null,
			assignment:
				module.type === "assignment"
					? {
							id: module.id,
							instructions: module.instructions || null,
							dueDate: module.dueDate || null,
							maxAttempts: module.maxAttempts || null,
							allowLateSubmissions: module.allowLateSubmissions || null,
							requireTextSubmission: module.requireTextSubmission || null,
							requireFileSubmission: module.requireFileSubmission || null,
							allowedFileTypes: module.allowedFileTypes || null,
							maxFileSize: module.maxFileSize || null,
							maxFiles: module.maxFiles || null,
						}
					: null,
			quiz:
				module.type === "quiz"
					? (() => {
							// Get rawQuizConfig to check for globalTimer
							const rawConfig =
								module.rawQuizConfig as unknown as QuizConfig | null;

							// Calculate timeLimit from globalTimer in config (convert seconds to minutes)
							const timeLimit = rawConfig?.globalTimer
								? rawConfig.globalTimer / 60
								: null;

							return {
								id: module.id,
								instructions: module.instructions || null,
								dueDate: module.dueDate || null,
								maxAttempts: module.maxAttempts || null,
								points: module.points || null,
								timeLimit,
								gradingType: module.gradingType || null,
								rawQuizConfig: rawConfig,
							};
						})()
					: null,
			discussion:
				module.type === "discussion"
					? {
							id: module.id,
							instructions: module.instructions || null,
							dueDate: module.dueDate || null,
							requireThread: module.requireThread || null,
							requireReplies: module.requireReplies || null,
							minReplies: module.minReplies || null,
						}
					: null,
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
		} satisfies UserModule;

		// Fetch linked courses with enrollments

		const linksResult = await tryFindLinksByActivityModule(payload, module.id);

		if (!linksResult.ok) throw linksResult.error;

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

		// Determine access type
		let accessType: "owned" | "granted" | "readonly" = "readonly";

		if (currentUser) {
			// Check if user is the owner
			if (module.owner.id === currentUser.id) {
				accessType = "owned";
			}
			// Check if user has been explicitly granted access
			else if (grants.some((grant) => grant.grantedTo.id === currentUser.id)) {
				accessType = "granted";
			}
			// Otherwise, they must be an instructor (readonly access)
			else {
				accessType = "readonly";
			}
		}

		return {
			module: transformedModule,
			accessType,
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
