/**
 * user context:
 * this context is available when user is logged in
 * it also stores all the activity modules that user has access to
 * it stores all the enrollments of this user
 * it stores all the notes created by this user with heatmap data
 */

import { executeAuthStrategies, parseCookies } from "payload";
import { createContext, type RouterContextProvider } from "react-router";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindEnrollmentsByUser } from "server/internal/enrollment-management";
import { tryGenerateNoteHeatmap } from "server/internal/note-management";
import { tryHandleImpersonation } from "server/internal/user-management";
import {
	createLocalReq,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "server/internal/utils/internal-function-utils";
import { permissions } from "server/utils/permissions";

export type UserContextResult = Awaited<ReturnType<typeof tryGetUserContext>>;

export type UserSession = NonNullable<UserContextResult["userSession"]>;

export const userContext = createContext<UserSession | null>(null);

export { userContextKey } from "./utils/context-keys";

interface TryGetUserContextArgs
	extends Pick<BaseInternalFunctionArgs, "payload" | "req"> {
	request: Request;
	routerContext: Readonly<RouterContextProvider>;
}

export const tryGetUserContext = async (args: TryGetUserContextArgs) => {
	const { payload, req, request, routerContext } = args;
	const headers = req?.headers ?? new Headers();
	// Get the authenticated user
	const { user: authenticatedUser } = await executeAuthStrategies({
		headers,
		canSetHeaders: true,
		payload,
	}).then(stripDepth<1, "find">());

	if (!authenticatedUser) {
		// No authenticated user - create unauthenticated payload request
		const payloadRequest = createLocalReq({
			request,
			user: null,
			context: { routerContext },
		});
		return {
			userSession: null,
			payloadRequest,
		};
	}

	// Check for impersonation cookie
	const cookies = parseCookies(headers);
	const impersonateUserId = cookies.get(
		`${payload.config.cookiePrefix}-impersonate`,
	);

	const impersonationResult =
		impersonateUserId && authenticatedUser.role === "admin"
			? await tryHandleImpersonation({
					payload,
					impersonateUserId,
					req,
				})
			: null;

	const { effectiveUser, isImpersonating } =
		impersonationResult?.ok && impersonationResult.value
			? {
					effectiveUser: {
						...impersonationResult.value.targetUser,
						collection: "users" as const,
					},
					isImpersonating: true,
				}
			: {
					effectiveUser: null,
					isImpersonating: false,
				};

	const currentUser = effectiveUser || authenticatedUser;

	// Create authenticated payload request with the current user
	const payloadRequest = createLocalReq({
		request,
		user: currentUser,
		context: { routerContext },
	});

	// Fetch user access data (activity modules, enrollments, notes)
	// Using the authenticated payloadRequest
	const { modulesOwnedOrGranted, autoGrantedModules } =
		await tryGetUserActivityModules({
			payload,
			userId: currentUser.id,
			req: payloadRequest,
		}).getOrThrow();

	const enrollments = await tryFindEnrollmentsByUser({
		payload,
		userId: currentUser.id,
		req: payloadRequest,
	}).getOrThrow();

	const enrollmentsData = enrollments.map((enrollment) => ({
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
			category: enrollment.course.category ?? null,
			thumbnail: enrollment.course.thumbnail ?? null,
			recurringSchedules: enrollment.course.recurringSchedules ?? [],
			specificDates: enrollment.course.specificDates ?? [],
		},
	}));

	const activityModules = [
		...modulesOwnedOrGranted.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description ?? "",
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			type: module.type,
			linkedCourses: module.linkedCourses,
			accessType:
				module.owner.id === currentUser.id
					? ("owned" as const)
					: ("granted" as const),
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
	];

	// Fetch notes and heatmap data
	const heatmapResult = await tryGenerateNoteHeatmap({
		payload,
		userId: currentUser.id,
		req: payloadRequest,
	}).getOrThrow();

	const { notes, heatmapData, availableYears } = heatmapResult;

	return {
		userSession: {
			authenticatedUser: {
				...authenticatedUser,
				avatar: authenticatedUser.avatar?.id ?? null,
				direction: authenticatedUser.direction ?? "ltr",
			},
			effectiveUser: effectiveUser,
			isImpersonating: isImpersonating,
			isAuthenticated: true as const,
			permissions: {
				canSeeUserModules: permissions.user.canSeeModules(currentUser).allowed,
			},
			// User access data (merged from userAccessContext)
			activityModules: activityModules.filter(
				// unique by id
				(module, index, self) =>
					self.findIndex((m) => m.id === module.id) === index,
			),
			enrollments: enrollmentsData,
			notes,
			heatmapData,
			availableYears,
		},
		payloadRequest,
	};
};
