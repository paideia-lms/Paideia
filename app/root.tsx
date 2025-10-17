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
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import {
	getUserAccessContext,
	userAccessContextKey,
} from "server/contexts/user-access-context";
import {
	tryGetUserContext,
	userContextKey,
} from "server/contexts/user-context";
import { tryGetUserCount } from "server/internal/check-first-user";
import { type RouteParams, tryGetRouteHierarchy } from "./utils/routes-utils";
import { tryFindCourseActivityModuleLinkById } from "server/internal/course-activity-module-link-management";
import { tryFindSectionById } from "server/internal/course-section-management";

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
		let isCourseSettings = false;
		let isCourseParticipants = false;
		let isCourseParticipantsLayout = false;
		let isCourseGroups = false;
		let isCourseGrades = false;
		let isCourseModules = false;
		let isCourseBin = false;
		let isCourseBackup = false;
		let isCourseModule = false;
		let isCourseSection = false;
		let isUserLayout = false;
		let isUserOverview = false;
		let isUserPreference = false;
		let isUserModules = false;
		let isUserGrades = false;
		let isUserNotes = false;
		let isUserNoteCreate = false;
		let isUserNoteEdit = false;
		let isUserModuleNew = false;
		let isUserModuleEdit = false;
		for (const route of routeHierarchy) {
			if (route.id === "layouts/server-admin-layout") isAdmin = true;
			else if (route.id === "routes/course") isMyCourses = true;
			else if (route.id === "routes/index") isDashboard = true;
			else if (route.id === "routes/login") isLogin = true;
			else if (route.id === "routes/first-user") isFirstUser = true;
			else if (route.id === "layouts/course-layout") isInCourse = true;
			else if (route.id === "routes/course.$id.settings")
				isCourseSettings = true;
			else if (route.id === "layouts/course-participants-layout")
				isCourseParticipantsLayout = true;
			else if (route.id === "routes/course.$id.participants")
				isCourseParticipants = true;
			else if (route.id === "routes/course.$id.groups")
				isCourseGroups = true;
			else if (route.id === "routes/course.$id.grades") isCourseGrades = true;
			else if (route.id === "routes/course.$id.modules") isCourseModules = true;
			else if (route.id === "routes/course.$id.bin") isCourseBin = true;
			else if (route.id === "routes/course.$id.backup") isCourseBackup = true;
			else if (route.id === "routes/course/module.$id") isCourseModule = true;
			else if (route.id === "routes/course/section.$id") isCourseSection = true;
			else if (route.id === "layouts/user-layout") isUserLayout = true;
			else if (route.id === "routes/user/overview") isUserOverview = true;
			else if (route.id === "routes/user/edit") isUserPreference = true;
			else if (route.id === "routes/user/modules") isUserModules = true;
			else if (route.id === "routes/user/grades") isUserGrades = true;
			else if (route.id === "routes/user/notes") isUserNotes = true;
			else if (route.id === "routes/user/note-create") isUserNoteCreate = true;
			else if (route.id === "routes/user/note-edit") isUserNoteEdit = true;
			else if (route.id === "routes/user/module/new") isUserModuleNew = true;
			else if (route.id === "routes/user/module/edit") isUserModuleEdit = true;
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
				isCreatingFirstUser: isFirstUser,
				isInCourse,
				isCourseSettings,
				isCourseParticipants,
				isCourseParticipantsLayout,
				isCourseGroups,
				isCourseGrades,
				isCourseModules,
				isCourseBin,
				isCourseBackup,
				isCourseModule,
				isCourseSection,
				isUserLayout,
				isUserOverview,
				isUserPreference,
				isUserModules,
				isUserGrades,
				isUserNotes,
				isUserNoteCreate,
				isUserNoteEdit,
				isUserModuleNew,
				isUserModuleEdit,
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
		const { payload, routeHierarchy, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const currentUser = userSession?.effectiveUser || userSession?.authenticatedUser

		// check if the user is in a course
		if (routeHierarchy.some((route) => route.id === "layouts/course-layout")) {
			const { id } = params as RouteParams<"layouts/course-layout">;

			if (Number.isNaN(id)) return;

			// default course id is the id from params
			let courseId: number = Number(id);

			// in course/module/id , we need to get the module first and then get the course id
			if (pageInfo.isCourseModule) {
				const { id: moduleId } = params as RouteParams<"routes/course/module.$id">;

				if (Number.isNaN(moduleId)) return;

				const moduleContext = await tryFindCourseActivityModuleLinkById(payload, Number(moduleId));

				if (!moduleContext.ok) return;

				const module = moduleContext.value;
				const { course } = module
				// update the course id to the course id from the module
				courseId = course.id;
			}

			// in course/section/id , we need to get the section first and then get the course id
			if (pageInfo.isCourseSection) {
				const { id: sectionId } = params as RouteParams<"routes/course/section.$id">;

				if (Number.isNaN(sectionId)) return;

				const sectionContext = await tryFindSectionById({
					payload,
					sectionId: Number(sectionId),
					user: currentUser ? {
						...currentUser,
						avatar: currentUser?.avatar?.id,
					} : null,
				});

				if (!sectionContext.ok) return;

				const section = sectionContext.value;
				// update the course id to the course id from the section
				courseId = section.course;
			}

			const courseContext = await tryGetCourseContext(payload, courseId, userSession?.effectiveUser || userSession?.authenticatedUser || null);

			context.set(courseContextKey, courseContext);
		}
	},
	// set the user access context
	async ({ request, context }) => {
		const { payload } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (userSession?.isAuthenticated) {
			const userAccessContext = await getUserAccessContext(
				payload,
				userSession.effectiveUser || userSession.authenticatedUser || null,
			);
			context.set(userAccessContextKey, userAccessContext);
		}
	},
	// set the enrolment context
	async ({ request, context }) => {
		const { payload } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (userSession?.isAuthenticated && courseContext) {
			// get the enrollment
			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;
			const enrollment = courseContext.course.enrollments.find(
				(e) => e.userId === currentUser?.id,
			);

			// set the enrolment context
			if (enrollment) {
				context.set(enrolmentContextKey, {
					enrolment: enrollment,
				});
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
		pageInfo.isCreatingFirstUser ||
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
