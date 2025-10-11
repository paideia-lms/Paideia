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
import elysiaLogo from "./assets/elysia_v.webp";
import reactRouterLogo from "./assets/rr_lockup_light.png";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/tiptap/styles.css";

import { Button, ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { useState } from "react";
import { tryGetUserCount } from "server/internal/check-first-user";

export async function loader({ request, context }: Route.LoaderArgs) {
	const { payload, requestInfo } = context.get(globalContextKey);
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
		currentPath === "/first-user" ||
		currentPath === "/login" ||
		currentPath.startsWith("/api/")
	) {
		return {
			users: users,
		};
	}

	// If no users exist, redirect to first-user creation
	if (users === 0) {
		throw redirect(href("/first-user"));
	}

	const timestamp = new Date().toISOString();

	return {
		users: users,
		domainUrl: requestInfo.domainUrl,
		timestamp: timestamp,
	};
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<html lang="en">
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
				<MantineProvider>
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
