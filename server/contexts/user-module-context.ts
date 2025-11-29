import { createContext } from "react-router";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
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
import {
	type ActivityModuleResult,
	tryGetActivityModuleById,
} from "../internal/activity-module-management";
import { tryFindLinksByActivityModule } from "../internal/course-activity-module-link-management";
import type { Course } from "../payload-types";

export interface UserModuleUser {
	id: number;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	avatar?:
		| number
		| {
				id: number;
				filename?: string;
		  }
		| null;
}

export interface UserModuleGrant {
	id: number;
	grantedTo: UserModuleUser;
	grantedBy: UserModuleUser;
	grantedAt: string;
}

export interface Instructor {
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
}

export interface UserModuleContext {
	module: ActivityModuleResult;
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
}

export const userModuleContext = createContext<UserModuleContext | null>();

export { userModuleContextKey } from "./utils/context-keys";

interface TryGetUserModuleContextArgs extends BaseInternalFunctionArgs {
	moduleId: number;
}
/**
 * Get user module context for a given module ID
 * This includes the module data, linked courses, grants, and instructors
 */
export const tryGetUserModuleContext = Result.wrap(
	async ({
		payload,
		req,
		overrideAccess = false,
		moduleId,
	}: TryGetUserModuleContextArgs) => {
		const currentUser = req?.user;

		// Fetch the activity module
		const moduleResult = await tryGetActivityModuleById({
			payload,
			id: moduleId,
			req,
			overrideAccess,
		});

		if (!moduleResult.ok) {
			throw new NonExistingActivityModuleError("Activity module not found");
		}

		const module = moduleResult.value;

		// Fetch linked courses with enrollments

		const linksResult = await tryFindLinksByActivityModule({
			payload,
			activityModuleId: module.id,
			req,
			overrideAccess,
		});

		if (!linksResult.ok) throw linksResult.error;

		// Fetch grants
		const grantsResult = await tryFindGrantsByActivityModule({
			payload,
			activityModuleId: module.id,
			req,
			overrideAccess,
		});
		const grants: UserModuleGrant[] = grantsResult.ok ? grantsResult.value : [];

		const instructorsResult = await tryFindInstructorsForActivityModule({
			payload,
			activityModuleId: module.id,
			req,
			overrideAccess,
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
			module,
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
