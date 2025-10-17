/**
 * user profile context:
 * this context is available when viewing a user's profile
 * it stores all the activity modules that the profile user has access to
 * it stores all the enrollments of the profile user
 *
 * Note: This is different from user-access-context which is for the authenticated user
 * This context is for the user whose profile is being viewed (could be self or another user)
 */
import type { Payload } from "payload";
import { createContext, href } from "react-router";
import type { UserAccessContext } from "server/contexts/user-access-context";
import type { User } from "server/contexts/user-context";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";
import { tryFindUserById } from "server/internal/user-management";

type Course = {
	id: number;
	title: string;
	slug: string;
	status: "draft" | "published" | "archived";
	description: string;
	createdAt: string;
	updatedAt: string;
	category?: {
		id: number;
		name: string;
		parent?: {
			id: number;
			name: string;
		} | null;
	} | null;
};

type ActivityModule = {
	id: number;
	title: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	type: "quiz" | "assignment" | "discussion" | "page" | "whiteboard";
	status: "draft" | "published" | "archived";
	linkedCourses: number[];
};

/**
 * all the profile user's enrollments
 */
export type Enrollment = {
	id: number;
	role: "student" | "teacher" | "ta" | "manager";
	status: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string | null;
	completedAt?: string | null;
	course: Course;
};

export interface UserProfileContext {
	/** The user whose profile is being viewed */
	profileUserId: number;
	/** User profile data */
	profileUser: {
		id: number;
		firstName: string;
		lastName: string;
		bio: string;
		email: string;
		role:
			| "student"
			| "instructor"
			| "admin"
			| "content-manager"
			| "analytics-viewer";
		avatarUrl: string | null;
	};
	/** Activity modules accessible by the profile user */
	activityModules: ActivityModule[];
	/** Enrollments of the profile user */
	enrollments: Enrollment[];
}

export const userProfileContext = createContext<UserProfileContext | null>(
	null,
);

export const userProfileContextKey =
	"userProfileContext" as unknown as typeof userProfileContext;

/**
 * Convert UserAccessContext to UserProfileContext
 * This is useful when viewing your own profile to avoid duplicate queries
 */
export const convertUserAccessContextToUserProfileContext = (
	userAccessContext: UserAccessContext,
	user: User,
): UserProfileContext => {
	// UserAccessContext and UserProfileContext have similar structure
	// We just need to add the profileUserId and profileUser fields
	// The activityModules and enrollments are already in the correct format

	// Handle avatar URL
	let avatarUrl: string | null = null;
	if (user.avatar?.filename) {
		avatarUrl = href(`/api/media/file/:filename`, {
			filename: user.avatar.filename,
		});
	}

	return {
		profileUserId: user.id,
		profileUser: {
			id: user.id,
			firstName: user.firstName ?? "",
			lastName: user.lastName ?? "",
			bio: user.bio ?? "",
			email: user.email,
			role: user.role ?? "student",
			avatarUrl,
		},
		activityModules: userAccessContext.activityModules,
		enrollments: userAccessContext.enrollments,
	};
};

export const getUserProfileContext = async (
	payload: Payload,
	/**
	 * the profile user id (the user being viewed)
	 */
	profileUserId: number,
	/**
	 * the current user, need to verify the access
	 */
	currentUser: User,
): Promise<UserProfileContext | null> => {
	// Fetch the profile user data
	const userResult = await tryFindUserById({
		payload,
		userId: profileUserId,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!userResult.ok) throw new Error("Failed to get user profile");

	const profileUser = userResult.value;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (profileUser.avatar) {
		if (typeof profileUser.avatar === "object" && profileUser.avatar.filename) {
			avatarUrl = href(`/api/media/file/:filename`, {
				filename: profileUser.avatar.filename,
			});
		}
	}

	const result = await tryGetUserActivityModules(payload, {
		userId: profileUserId,
		user: {
			...currentUser,
			collection: "users",
		},
		overrideAccess: true,
	});

	if (!result.ok) throw new Error("Failed to get user activity modules");

	const { modulesOwnedOrGranted, autoGrantedModules } = result.value;

	const enrollments = await tryFindEnrollmentsByUser(
		payload,
		profileUserId,
		{
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		undefined,
		true,
	);

	if (!enrollments.ok) throw new Error("Failed to get user enrollments");

	const enrollmentsData = enrollments.value.map(
		(enrollment) =>
			({
				id: enrollment.id,
				role: enrollment.role,
				status: enrollment.status,
				enrolledAt: enrollment.enrolledAt,
				completedAt: enrollment.completedAt,
				course: {
					id: enrollment.course.id,
					title: enrollment.course.title,
					slug: enrollment.course.slug,
					status: enrollment.course.status,
					description: enrollment.course.description,
					createdAt: enrollment.course.createdAt,
					updatedAt: enrollment.course.updatedAt,
				},
			}) satisfies Enrollment,
	);

	const activityModules = [
		...modulesOwnedOrGranted.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			status: module.status,
			linkedCourses: module.linkedCourses,
		})),
		...autoGrantedModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			status: module.status,
			linkedCourses: module.linkedCourses.map((c) => c.id),
		})),
	] satisfies ActivityModule[];

	return {
		profileUserId,
		profileUser: {
			id: profileUser.id,
			firstName: profileUser.firstName ?? "",
			lastName: profileUser.lastName ?? "",
			bio: profileUser.bio ?? "",
			email: profileUser.email,
			role: profileUser.role ?? "student",
			avatarUrl,
		},
		activityModules: activityModules.filter(
			// unique by id
			(module, index, self) =>
				self.findIndex((m) => m.id === module.id) === index,
		),
		enrollments: enrollmentsData,
	};
};
