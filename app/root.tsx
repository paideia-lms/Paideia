import {
	href,
	Links,
	Meta,
	Outlet,
	redirect,
	Scripts,
	ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/tiptap/styles.css";

import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { parseCookies } from "payload";
import { userContextKey } from "server/contexts/user-context";
import { tryGetUserCount } from "server/internal/check-first-user";
import { tryFindCourseById } from "server/internal/course-management";
import { tryHandleImpersonation } from "server/internal/user-management";
import type { User as PayloadUser } from "server/payload-types";
import { tryGetRouteHierarchy } from "./utils/routes-utils";

export const middleware = [
	async ({ request, context }) => {
		const routeHierarchy = tryGetRouteHierarchy(new URL(request.url).pathname);
		let isAdmin = false;
		let isMyCourses = false;
		let isDashboard = false;
		let isLogin = false;
		let isFirstUser = false;
		let isInCourse = false;

		for (const route of routeHierarchy) {
			if (route.id === "layouts/server-admin-layout") isAdmin = true;
			else if (route.id === "routes/course") isMyCourses = true;
			else if (route.id === "routes/index") isDashboard = true;
			else if (route.id === "routes/login") isLogin = true;
			else if (route.id === "routes/first-user") isFirstUser = true;
			else if (route.id === "layouts/course-layout") isInCourse = true;
		}

		// set the route hierarchy and page info to the context
		context.set(globalContextKey, {
			...context.get(globalContextKey),
			routeHierarchy,
			pageInfo: {
				isAdmin,
				isMyCourses,
				isDashboard,
				isLogin,
				isFirstUser,
				isInCourse,
			},
		});
	},
	async ({ request, context }) => {
		const { payload } = context.get(globalContextKey);

		// Get the authenticated user
		const { user: authenticatedUser } = await payload.auth({
			headers: request.headers,
			canSetHeaders: true,
		});

		if (!authenticatedUser) {
			// No authenticated user, don't set context - let it use default null value
			return;
		}

		// Check for impersonation cookie
		const cookies = parseCookies(request.headers);
		const impersonateUserId = cookies.get(
			`${payload.config.cookiePrefix}-impersonate`,
		);

		let effectiveUser: PayloadUser | null = null;
		let effectiveUserPermissions: string[] | null = null;
		let isImpersonating = false;

		// If impersonation cookie exists and user is admin
		if (impersonateUserId && authenticatedUser.role === "admin") {
			const impersonationResult = await tryHandleImpersonation({
				payload,
				impersonateUserId,
				authenticatedUser,
			});

			if (impersonationResult.ok && impersonationResult.value) {
				effectiveUser = impersonationResult.value.targetUser;
				effectiveUserPermissions = impersonationResult.value.permissions;
				isImpersonating = true;
			}
		}

		// Set the user context
		context.set(userContextKey, {
			authenticatedUser: authenticatedUser,
			effectiveUser,
			authenticatedUserPermissions: effectiveUserPermissions ?? [],
			effectiveUserPermissions,
			isImpersonating,
			isAuthenticated: true,
		});
	},
	async ({ request, context }) => {
		const { payload, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// Only set course context if we're in a course route and user is authenticated
		if (pageInfo.isInCourse && userSession?.isAuthenticated) {
			const url = new URL(request.url);
			const pathname = url.pathname;

			// Extract course ID from URL patterns like /course/view/:id or /course/edit/:id
			const courseIdMatch = pathname.match(/\/course\/(?:view|edit)\/(\d+)/);

			if (courseIdMatch) {
				const courseId = Number.parseInt(courseIdMatch[1], 10);

				if (!Number.isNaN(courseId)) {
					try {
						const courseResult = await tryFindCourseById(payload, courseId);

						if (courseResult.ok) {
							const course = courseResult.value;

							// Set course context
							context.set(courseContextKey, {
								course: {
									id: course.id,
									title: course.title,
									slug: course.slug,
									description: course.description,
									status: course.status,
									structure: course.structure,
									createdBy: {
										id: course.createdBy.id,
										email: course.createdBy.email,
										firstName: course.createdBy.firstName,
										lastName: course.createdBy.lastName,
									},
									category:
										typeof course.category === "number"
											? course.category
											: course.category?.id,
									updatedAt: course.updatedAt,
									createdAt: course.createdAt,
								},
								courseId,
							});
						}
					} catch {
						// Course not found or access denied - don't set context
						// This is expected behavior, so we don't throw
					}
				}
			}
		}
	},
] satisfies Route.MiddlewareFunction[];

export async function loader({ request, context }: Route.LoaderArgs) {
	const { payload, requestInfo, pageInfo } = context.get(globalContextKey);
	const timestamp = new Date().toISOString();
	// console.log(routes)
	// ! we can get elysia from context!!!
	// console.log(payload, elysia);
	const result = await tryGetUserCount({ payload, overrideAccess: true });

	if (!result.ok) {
		throw new Error("Failed to get user count");
	}

	const users = result.value;

	// Check if we need to redirect to first-user creation
	const url = new URL(request.url);

	const currentPath = url.pathname;

	// Skip redirect check for essential routes
	if (
		pageInfo.isFirstUser ||
		pageInfo.isLogin ||
		currentPath.startsWith("/api/")
	) {
		return {
			users: users,
			domainUrl: requestInfo.domainUrl,
			timestamp: timestamp,
			pageInfo: pageInfo,
		};
	}

	// If no users exist, redirect to first-user creation
	if (users === 0) {
		throw redirect(href("/first-user"));
	}

	return {
		users: users,
		domainUrl: requestInfo.domainUrl,
		timestamp: timestamp,
		pageInfo: pageInfo,
	};
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<html lang="en" data-mantine-color-scheme="light">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta title="Paideia LMS" />
				<meta name="description" content="Paideia LMS" />
				{/* ! this will force the browser to reload the favicon, see https://stackoverflow.com/questions/2208933/how-do-i-force-a-favicon-refresh */}
				<link
					rel="icon"
					href={`/favicon.ico?timestamp=${loaderData.timestamp}`}
				/>
				<Meta />
				<Links />
				<ColorSchemeScript />
			</head>
			<body>
				<MantineProvider defaultColorScheme="light">
					<NuqsAdapter>
						<Outlet />
						<Notifications />
					</NuqsAdapter>
				</MantineProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
