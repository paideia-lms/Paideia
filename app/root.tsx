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
import { tryHandleImpersonation } from "server/internal/user-management";
import type { User as PayloadUser } from "server/payload-types";
import { tryGetRouteHierarchy } from "./utils/routes-utils";

export const middleware = [
	async ({ request, context }) => {
		const routeHierarchy = tryGetRouteHierarchy(new URL(request.url).pathname);
		const isAdmin = !!routeHierarchy.find(route => route.id === "layouts/server-admin-layout");
		const isMyCourses = !!routeHierarchy.find(route => route.id === "routes/course");
		const isDashboard = !!routeHierarchy.find(route => route.id === "routes/index");
		const isLogin = !!routeHierarchy.find(route => route.id === "routes/login");
		const isFirstUser = !!routeHierarchy.find(route => route.id === "routes/first-user");

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
			},
		});
	},
	async ({ request, context, },) => {
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
				<link rel="icon" href={`/favicon.ico?timestamp=${loaderData.timestamp}`} />
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
