/**
 * user context:
 * this context is available when user is logged in
 * it also stores all the activity modules that user has access to
 * it stores all the enrollments of this user
 * it stores all the notes created by this user with heatmap data
 */

import type { Paideia } from "@paideia/core";
import { stripDepth } from "@paideia/core";
import { createContext, type RouterContextProvider } from "react-router";
import { permissions } from "@paideia/core";

export type UserContextResult = Awaited<ReturnType<typeof tryGetUserContext>>;

export type UserSession = NonNullable<UserContextResult["userSession"]>;

export const userContext = createContext<UserSession | null>(null);

export { userContextKey } from "./utils/context-keys";

interface TryGetUserContextArgs {
	paideia: Paideia;
	request: Request;
	routerContext: Readonly<RouterContextProvider>;
}

export const tryGetUserContext = async (args: TryGetUserContextArgs) => {
	const { paideia, request, routerContext } = args;
	const headers = request.headers;
	// Get the authenticated user
	const { user: authenticatedUser } = await paideia
		.executeAuthStrategies({
			headers,
			canSetHeaders: true,
		})
		.then(stripDepth<1, "find">());

	if (!authenticatedUser) {
		// No authenticated user - create unauthenticated request context
		const requestContext = paideia.createRequestContext({
			request,
			user: null,
			context: { routerContext },
		});
		return {
			userSession: null,
			requestContext,
		};
	}

	// Check for impersonation cookie
	const cookies = paideia.parseCookies(headers);
	const impersonateUserId = cookies.get(
		`${paideia.getCookiePrefix()}-impersonate`,
	);

	const initialReq = paideia.createRequestContext({
		request,
		user: null,
		context: { routerContext },
	});

	const impersonationResult =
		impersonateUserId && authenticatedUser.role === "admin"
			? await paideia.tryHandleImpersonation({
					impersonateUserId,
					req: initialReq,
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

	// Create authenticated request context with the current user
	const requestContext = paideia.createRequestContext({
		request,
		user: currentUser,
		context: { routerContext },
	});

	// Fetch user access data (activity modules, enrollments, notes)
	const { modulesOwnedOrGranted, autoGrantedModules } = await paideia
		.tryGetUserActivityModules({
			userId: currentUser.id,
			req: requestContext,
		})
		.getOrThrow();

	const enrollments = await paideia
		.tryFindEnrollmentsByUser({
			userId: currentUser.id,
			req: requestContext,
		})
		.getOrThrow();

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
	const heatmapResult = await paideia
		.tryGenerateNoteHeatmap({
			userId: currentUser.id,
			req: requestContext,
		})
		.getOrThrow();

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
		requestContext,
	};
};
