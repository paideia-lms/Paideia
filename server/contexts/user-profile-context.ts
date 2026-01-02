/**
 * user profile context:
 * this context is available when viewing a user's profile
 * it stores all the activity modules that the profile user has access to
 * it stores all the enrollments of the profile user
 * it stores all the notes created by the profile user with heatmap data
 *
 * Note: This is different from user-access-context which is for the authenticated user
 * This context is for the user whose profile is being viewed (could be self or another user)
 */
import { createContext, href } from "react-router";
import type { UserAccessContext } from "server/contexts/user-access-context";
import type { GlobalContext } from "server/contexts/global-context";
import type { UserSession } from "server/contexts/user-context";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";
import { tryGenerateNoteHeatmap } from "server/internal/note-management";
import { tryFindUserById } from "server/internal/user-management";
import type {
	ActivityModule as PayloadActivityModule,
	Enrollment as PayloadEnrollment,
} from "server/payload-types";
import { permissions } from "server/utils/permissions";

type Course = {
	id: number;
	title: string;
	slug: string;
	status: "draft" | "published" | "archived";
	description: string;
	createdAt: string;
	updatedAt: string;
	category?: number | null;
};

type ActivityModule = {
	id: number;
	title: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	type: PayloadActivityModule["type"];
	linkedCourses: number[];
	accessType: "owned" | "granted" | "readonly";
};

/**
 * all the profile user's enrollments
 */
export type Enrollment = {
	id: number;
	role: PayloadEnrollment["role"];
	status: PayloadEnrollment["status"];
	enrolledAt?: string | null;
	completedAt?: string | null;
	course: Course;
};

// export interface UserProfileContext {
// 	/** The user whose profile is being viewed */
// 	profileUserId: number;
// 	/** User profile data */
// 	profileUser: {
// 		id: number;
// 		firstName: string;
// 		lastName: string;
// 		bio: string;
// 		email: string;
// 		role:
// 			| "student"
// 			| "instructor"
// 			| "admin"
// 			| "content-manager"
// 			| "analytics-viewer";
// 		avatarUrl: string | null;
// 	};
// 	/** Activity modules accessible by the profile user */
// 	activityModules: ActivityModule[];
// 	/** Enrollments of the profile user */
// 	enrollments: Enrollment[];
// 	/** Notes created by the profile user */
// 	notes: Note[];
// 	/** Heatmap data for notes */
// 	heatmapData: Record<string, number>;
// 	/** Years with available notes */
// 	availableYears: number[];
// 	/** Permissions for editing profile fields */
// 	permissions: {
// 		canImpersonate: PermissionResult;
// 		firstName: PermissionResult;
// 		lastName: PermissionResult;
// 		email: PermissionResult;
// 		bio: PermissionResult;
// 		avatar: PermissionResult;
// 		role: PermissionResult;
// 		canEdit: PermissionResult;
// 	};
// }

export type UserProfileContext = Awaited<
	ReturnType<typeof getUserProfileContext>
>;

export const userProfileContext = createContext<UserProfileContext | null>(
	null,
);

export { userProfileContextKey } from "./utils/context-keys";

/**
 * Convert UserAccessContext to UserProfileContext
 * This is useful when viewing your own profile to avoid duplicate queries
 */
export const convertUserAccessContextToUserProfileContext = (
	userAccessContext: UserAccessContext,
	userSession: UserSession,
	globalContext: GlobalContext,
) => {
	// UserAccessContext and UserProfileContext have similar structure
	// We just need to add the profileUserId and profileUser fields
	// The activityModules and enrollments are already in the correct format

	// Extract values from contexts
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	const authenticatedUser = userSession.authenticatedUser;
	const isImpersonating = userSession.isImpersonating ?? false;
	const isSandboxMode = globalContext.envVars.SANDBOX_MODE.enabled;

	// Handle avatar URL
	const avatarUrl = currentUser.avatar
		? href(`/api/media/file/:mediaId`, {
				mediaId: currentUser.avatar.toString(),
			})
		: null;

	const profileUser = {
		id: currentUser.id,
		firstName: currentUser.firstName ?? "",
		lastName: currentUser.lastName ?? "",
		bio: currentUser.bio ?? "",
		email: currentUser.email,
		role: currentUser.role ?? "student",
		avatarUrl,
	};

	// Calculate permissions
	const profilePermissions = {
		canImpersonate: permissions.user.canImpersonate(
			authenticatedUser ?? undefined,
			currentUser.id,
			currentUser.role ?? "student",
			isImpersonating,
		),
		firstName: permissions.user.profile.fields.canEditFirstName(
			currentUser,
			profileUser,
			isSandboxMode,
		),
		lastName: permissions.user.profile.fields.canEditLastName(
			currentUser,
			profileUser,
			isSandboxMode,
		),
		email: permissions.user.profile.canEditEmail(),
		bio: permissions.user.profile.fields.canEditBio(
			currentUser,
			profileUser,
			isSandboxMode,
		),
		avatar: permissions.user.profile.fields.canEditAvatar(
			currentUser,
			profileUser,
			isSandboxMode,
		),
		role: permissions.user.profile.canEditRole(
			currentUser,
			profileUser,
			isSandboxMode,
		),
		canEdit: permissions.user.profile.fields.canEdit(
			currentUser,
			profileUser,
			isSandboxMode,
		),
	};

	return {
		profileUserId: currentUser.id,
		profileUser,
		currentUser,
		activityModules: userAccessContext.activityModules,
		enrollments: userAccessContext.enrollments,
		notes: userAccessContext.notes,
		heatmapData: userAccessContext.heatmapData,
		availableYears: userAccessContext.availableYears,
		permissions: profilePermissions,
	} satisfies UserProfileContext;
};

interface GetUserProfileContextArgs
	extends Omit<BaseInternalFunctionArgs, "payload" | "req"> {
	profileUserId: number;
	userSession: UserSession;
	globalContext: GlobalContext;
}

export const getUserProfileContext = async (
	args: GetUserProfileContextArgs,
) => {
	const { profileUserId, userSession, globalContext, overrideAccess } = args;
	const { payload, payloadRequest: req, envVars } = globalContext;

	// Extract values from contexts
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	const authenticatedUser = userSession.authenticatedUser;
	const isImpersonating = userSession.isImpersonating ?? false;
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;
	// Fetch the profile user data
	const userResult = await tryFindUserById({
		payload,
		userId: profileUserId,
		req,
		overrideAccess,
	});

	if (!userResult.ok) throw new Error("Failed to get user profile");

	const profileUserData = userResult.value;

	// Handle avatar - could be Media object or just ID
	const avatarUrl = profileUserData.avatar
		? href(`/api/media/file/:mediaId`, {
				mediaId: profileUserData.avatar.toString(),
			})
		: null;

	const profileUser = {
		id: profileUserData.id,
		firstName: profileUserData.firstName ?? "",
		lastName: profileUserData.lastName ?? "",
		bio: profileUserData.bio ?? "",
		email: profileUserData.email,
		role: profileUserData.role ?? "student",
		avatarUrl,
	};

	const result = await tryGetUserActivityModules({
		payload,
		userId: profileUserId,
		req,
		overrideAccess,
	});

	if (!result.ok) throw new Error("Failed to get user activity modules");

	const { modulesOwnedOrGranted, autoGrantedModules } = result.value;

	const enrollments = await tryFindEnrollmentsByUser({
		payload,
		userId: profileUserId,
		req,
		overrideAccess,
	}).getOrThrow();

	const enrollmentsData = enrollments.map(
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
			linkedCourses: module.linkedCourses,
			accessType: (module.owner.id === profileUserId ? "owned" : "granted") as
				| "owned"
				| "granted",
		})),
		...autoGrantedModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			linkedCourses: module.linkedCourses.map((c) => c.id),
			accessType: "readonly" as const,
		})),
	] satisfies ActivityModule[];

	// Fetch notes and heatmap data
	const heatmapResult = await tryGenerateNoteHeatmap({
		payload,
		userId: profileUserId,
		req,
		overrideAccess,
	}).getOrThrow();

	const { notes, heatmapData, availableYears } = heatmapResult;

	// Calculate permissions
	const profilePermissions = {
		canImpersonate: permissions.user.canImpersonate(
			authenticatedUser ?? undefined,
			profileUserId,
			profileUser.role,
			isImpersonating ?? false,
		),
		firstName: permissions.user.profile.fields.canEditFirstName(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
		lastName: permissions.user.profile.fields.canEditLastName(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
		email: permissions.user.profile.canEditEmail(),
		bio: permissions.user.profile.fields.canEditBio(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
		avatar: permissions.user.profile.fields.canEditAvatar(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
		role: permissions.user.profile.canEditRole(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
		canEdit: permissions.user.profile.fields.canEdit(
			currentUser,
			profileUser,
			isSandboxMode ?? false,
		),
	};

	return {
		profileUserId,
		profileUser,
		currentUser,
		activityModules: activityModules.filter(
			// unique by id
			(module, index, self) =>
				self.findIndex((m) => m.id === module.id) === index,
		),
		enrollments: enrollmentsData,
		notes,
		heatmapData,
		availableYears,
		permissions: profilePermissions,
	};
};
