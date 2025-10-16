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
import {
	courseContextKey,
	tryGetCourseContext,
} from "server/contexts/course-context";
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
import {
	tryGetUserContext,
	User,
	userContextKey,
} from "server/contexts/user-context";
import { tryGetUserCount } from "server/internal/check-first-user";
import { tryFindCourseById } from "server/internal/course-management";
import { tryHandleImpersonation } from "server/internal/user-management";
import type { User as PayloadUser } from "server/payload-types";
import { type RouteParams, tryGetRouteHierarchy } from "./utils/routes-utils";
import { getUserAccessContext, userAccessContextKey } from "server/contexts/user-access-context";

export const middleware = [
	/**
	 * update the page info to the global context
	 */
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
	/**
	 * set the user context
	 */
	async ({ request, context }) => {
		const { payload } = context.get(globalContextKey);

		const userSession = await tryGetUserContext(payload, request);

		// Set the user context
		context.set(userContextKey, userSession);
	},
	/**
	 * set the course context
	 */
	async ({ request, context, params }) => {
		const { payload, routeHierarchy } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// check if the user is in a course
		if (routeHierarchy.some((route) => route.id === "layouts/course-layout")) {
			const { id } = params as RouteParams<"layouts/course-layout">;
			if (!Number.isNaN(id)) {
				const courseContext = await tryGetCourseContext(
					payload,
					Number(id),
					userSession?.effectiveUser || userSession?.authenticatedUser || null,
				);
				context.set(courseContextKey, courseContext);
			}
		}
	},
	// set the user access context
	async ({ request, context }) => {
		const { payload } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (userSession?.isAuthenticated) {
			const userAccessContext = await getUserAccessContext(payload, userSession.effectiveUser || userSession.authenticatedUser || null);
			context.set(userAccessContextKey, userAccessContext);
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
