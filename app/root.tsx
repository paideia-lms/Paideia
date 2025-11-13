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
import {
	courseModuleContextKey,
	tryGetCourseModuleContext,
} from "server/contexts/course-module-context";
import {
	courseSectionContextKey,
	tryGetCourseSectionContext,
} from "server/contexts/course-section-context";
import { globalContextKey } from "server/contexts/global-context";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/code-highlight/styles.css";
import "@mantine/tiptap/styles.css";
import "@excalidraw/excalidraw/index.css";
import "mantine-datatable/styles.layer.css";

import { CodeHighlightAdapterProvider } from "@mantine/code-highlight";
import {
	ColorSchemeScript,
	createTheme,
	MantineProvider,
	Textarea,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import * as React from "react";
import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import {
	getUserAccessContext,
	userAccessContextKey,
} from "server/contexts/user-access-context";
import {
	tryGetUserContext,
	userContextKey,
} from "server/contexts/user-context";
import {
	tryGetUserModuleContext,
	userModuleContextKey,
} from "server/contexts/user-module-context";
import {
	convertUserAccessContextToUserProfileContext,
	getUserProfileContext,
	userProfileContextKey,
} from "server/contexts/user-profile-context";
import { tryGetUserCount } from "server/internal/check-first-user";
import { tryFindCourseActivityModuleLinkById } from "server/internal/course-activity-module-link-management";
import { tryFindSectionById } from "server/internal/course-section-management";
import { tryGetSystemGlobals } from "server/internal/system-globals";
import { RootErrorBoundary } from "./components/root-mode-error-boundary";
import { hintsUtils } from "./utils/client-hints";
import { customLowlightAdapter } from "./utils/lowlight-adapter";
import {
	ForbiddenResponse,
	InternalServerErrorResponse,
	MaintenanceModeResponse,
} from "./utils/responses";
import { type RouteParams, tryGetRouteHierarchy } from "./utils/routes-utils";

export const middleware = [
	/**
	 * update the page info to the global context
	 */
	async ({ request, context, params }) => {
		const routeHierarchy = tryGetRouteHierarchy(new URL(request.url).pathname);
		let isAdmin = false;
		let isMyCourses = false;
		let isDashboard = false;
		let isLogin = false;
		let isRegistration = false;
		let isCatalog = false;
		let isApi = false;
		let isInCourse = false;
		let isCourseSettings = false;
		let isCourseParticipants = false;
		let isCourseParticipantsProfile = false;
		let isCourseParticipantsLayout = false;
		let isCourseGroups = false;
		let isCourseGrades = false;
		let isCourseGradesLayout = false;
		let isCourseModules = false;
		let isCourseBin = false;
		let isCourseBackup = false;
		let isCourseModule = false;
		let isCourseModuleEdit = false;
		let isCourseModuleSubmissions = false;
		let isInCourseModuleLayout = false;
		let isCourseSection = false;
		let isCourseSectionNew = false;
		let isCourseSectionEdit = false;
		let isInCourseSectionLayout = false;
		let isUserLayout = false;
		let isUserOverview = false;
		let isUserPreference = false;
		let isUserModules = false;
		let isUserGrades = false;
		let isUserNotes = false;
		let isUserNoteCreate = false;
		let isUserNoteEdit = false;
		let isUserMedia = false;
		let isUserModuleNew = false;
		let isUserModuleEdit = false;
		let isUserModuleEditSetting = false;
		let isUserModuleEditAccess = false;
		let isInUserModuleEditLayout = false;
		let isUserProfile = false;
		let isInUserModulesLayout = false;
		let isAdminIndex = false;
		let isAdminUsers = false;
		let isAdminUserNew = false;
		let isAdminCourses = false;
		let isAdminCourseNew = false;
		let isAdminSystem = false;
		let isAdminTestEmail = false;
		let isAdminCategories = false;
		let isAdminCategoryNew = false;
		let isAdminRegistration = false;
		let isAdminMigrations = false;
		let isAdminDependencies = false;
		let isAdminCronJobs = false;
		let isAdminMaintenance = false;
		let isAdminSitePolicies = false;
		let isAdminMedia = false;
		let isAdminAppearance = false;
		let isAdminAnalytics = false;
		for (const route of routeHierarchy) {
			if (route.id.startsWith("routes/api/")) isApi = true;
			else if (route.id === "layouts/server-admin-layout") isAdmin = true;
			else if (route.id === "routes/course") isMyCourses = true;
			else if (route.id === "routes/index") isDashboard = true;
			else if (route.id === "routes/login") isLogin = true;
			else if (route.id === "routes/registration") isRegistration = true;
			else if (route.id === "routes/catalog") isCatalog = true;
			else if (route.id === "layouts/course-layout") isInCourse = true;
			else if (route.id === "routes/course.$id.settings")
				isCourseSettings = true;
			else if (route.id === "layouts/course-participants-layout")
				isCourseParticipantsLayout = true;
			else if (route.id === "routes/course.$id.participants")
				isCourseParticipants = true;
			else if (route.id === "routes/course.$id.participants.profile")
				isCourseParticipantsProfile = true;
			else if (route.id === "routes/course.$id.groups") isCourseGroups = true;
			else if (route.id === "routes/course.$id.grades") isCourseGrades = true;
			else if (route.id === "layouts/course-grades-layout")
				isCourseGradesLayout = true;
			else if (route.id === "routes/course.$id.modules") isCourseModules = true;
			else if (route.id === "routes/course.$id.bin") isCourseBin = true;
			else if (route.id === "routes/course.$id.backup") isCourseBackup = true;
			else if (route.id === "routes/course/module.$id") isCourseModule = true;
			else if (route.id === "routes/course/module.$id.edit")
				isCourseModuleEdit = true;
			else if (route.id === "routes/course/module.$id.submissions")
				isCourseModuleSubmissions = true;
			else if (route.id === "layouts/course-module-layout")
				isInCourseModuleLayout = true;
			else if (route.id === "routes/course/section.$id") isCourseSection = true;
			else if (route.id === "routes/course/section-new")
				isCourseSectionNew = true;
			else if (route.id === "routes/course/section-edit")
				isCourseSectionEdit = true;
			else if (route.id === "layouts/course-section-layout")
				isInCourseSectionLayout = true;
			else if (route.id === "layouts/user-layout") isUserLayout = true;
			else if (route.id === "routes/user/overview") isUserOverview = true;
			else if (route.id === "routes/user/preference") isUserPreference = true;
			else if (route.id === "routes/user/modules") isUserModules = true;
			else if (route.id === "routes/user/grades") isUserGrades = true;
			else if (route.id === "routes/user/notes") isUserNotes = true;
			else if (route.id === "routes/user/note-create") isUserNoteCreate = true;
			else if (route.id === "routes/user/note-edit") isUserNoteEdit = true;
			else if (route.id === "routes/user/media") isUserMedia = true;
			else if (route.id === "routes/user/module/new") isUserModuleNew = true;
			else if (route.id === "routes/user/module/edit") isUserModuleEdit = true;
			else if (route.id === "routes/user/module/edit-setting")
				isUserModuleEditSetting = true;
			else if (route.id === "routes/user/module/edit-access")
				isUserModuleEditAccess = true;
			else if (route.id === "layouts/user-module-edit-layout")
				isInUserModuleEditLayout = true;
			else if (route.id === "routes/user/profile") isUserProfile = true;
			else if (route.id === "layouts/user-modules-layout")
				isInUserModulesLayout = true;
			else if (route.id === "routes/admin/index") isAdminIndex = true;
			else if (route.id === "routes/admin/users") isAdminUsers = true;
			else if (route.id === "routes/admin/new") isAdminUserNew = true;
			else if (route.id === "routes/admin/courses") isAdminCourses = true;
			else if (route.id === "routes/admin/system") isAdminSystem = true;
			else if (route.id === "routes/admin/test-email") isAdminTestEmail = true;
			else if (route.id === "routes/admin/categories") isAdminCategories = true;
			else if (route.id === "routes/admin/category-new")
				isAdminCategoryNew = true;
			else if (route.id === "routes/admin/course-new") isAdminCourseNew = true;
			else if (route.id === "routes/admin/registration")
				isAdminRegistration = true;
			else if (route.id === "routes/admin/migrations") isAdminMigrations = true;
			else if (route.id === "routes/admin/dependencies")
				isAdminDependencies = true;
			else if (route.id === "routes/admin/cron-jobs") isAdminCronJobs = true;
			else if (route.id === "routes/admin/maintenance")
				isAdminMaintenance = true;
			else if (route.id === ("routes/admin/sitepolicies" as typeof route.id))
				isAdminSitePolicies = true;
			else if (route.id === "routes/admin/media") isAdminMedia = true;
			else if (route.id === ("routes/admin/appearance" as typeof route.id))
				isAdminAppearance = true;
			else if (route.id === ("routes/admin/analytics" as typeof route.id))
				isAdminAnalytics = true;
		}

		// set the route hierarchy and page info to the context
		context.set(globalContextKey, {
			...context.get(globalContextKey),
			routeHierarchy,
			pageInfo: {
				isInAdminLayout: isAdmin,
				isMyCourses,
				isDashboard,
				isLogin,
				isRegistration,
				isCatalog,
				isApi,
				isInCourse,
				isCourseSettings,
				isCourseParticipants,
				isCourseParticipantsProfile,
				isCourseParticipantsLayout,
				isCourseGroups,
				isCourseGrades,
				isCourseGradesLayout,
				isCourseModules,
				isCourseBin,
				isCourseBackup,
				isCourseModule,
				isCourseModuleEdit,
				isCourseModuleSubmissions,
				isInCourseModuleLayout,
				isCourseSection,
				isCourseSectionNew,
				isCourseSectionEdit,
				isInCourseSectionLayout,
				isUserLayout,
				isUserOverview,
				isUserPreference,
				isUserModules,
				isUserGrades,
				isUserNotes,
				isUserNoteCreate,
				isUserNoteEdit,
				isUserMedia,
				isUserModuleNew,
				isUserModuleEdit,
				isUserModuleEditSetting,
				isUserModuleEditAccess,
				isUserProfile,
				isInUserModulesLayout,
				isInUserModuleEditLayout,
				isAdminIndex,
				isAdminUsers,
				isAdminUserNew,
				isAdminCourses,
				isAdminSystem,
				isAdminTestEmail,
				isAdminCategories,
				isAdminCategoryNew,
				isAdminRegistration,
				isAdminCourseNew,
				isAdminMigrations,
				isAdminDependencies,
				isAdminCronJobs,
				isAdminMaintenance,
				isAdminSitePolicies,
				isAdminMedia,
				isAdminAppearance,
				isAdminAnalytics,
				params: params as Record<string, string>,
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
	 * Fetch system globals (maintenance mode, site policies, etc.) and check maintenance mode
	 */
	async ({ request, context }) => {
		const { payload, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// Fetch all system globals in one call
		const systemGlobalsResult = await tryGetSystemGlobals({
			payload,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		// If we can't get system globals, use defaults (fail open)
		const systemGlobals = systemGlobalsResult.ok
			? systemGlobalsResult.value
			: {
				maintenanceSettings: { maintenanceMode: false },
				sitePolicies: {
					userMediaStorageTotal: null,
					siteUploadLimit: null,
				},
				appearanceSettings: {
					additionalCssStylesheets: [],
				},
				analyticsSettings: {
					additionalJsScripts: [],
				},
			};

		// Store system globals in context for use throughout the app
		context.set(globalContextKey, {
			...context.get(globalContextKey),
			systemGlobals,
		});

		const { maintenanceMode } = systemGlobals.maintenanceSettings;

		// If maintenance mode is enabled
		if (maintenanceMode) {
			const currentUser =
				userSession?.effectiveUser || userSession?.authenticatedUser;

			// Allow access to login and admin maintenance page
			if (pageInfo.isLogin || pageInfo.isAdminMaintenance || pageInfo.isApi) {
				return;
			}

			// Block non-admin users
			if (!currentUser || currentUser.role !== "admin") {
				// If we're already on the root route, throw error instead of redirecting
				if (pageInfo.isDashboard) {
					throw new MaintenanceModeResponse(
						"The system is currently under maintenance. Only administrators can access the system at this time.",
					);
				}
				// Otherwise, redirect to root route
				throw redirect(href("/"));
			}
		}
	},
	/**
	 * set the course context
	 */
	async ({ context, params }) => {
		const { payload, routeHierarchy, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const currentUser =
			userSession?.effectiveUser || userSession?.authenticatedUser;

		// check if the user is in a course
		if (routeHierarchy.some((route) => route.id === "layouts/course-layout")) {
			const { id } = params as RouteParams<"layouts/course-layout">;

			if (Number.isNaN(id)) return;

			// default course id is the id from params
			let courseId: number = Number(id);

			// in course/module/id , we need to get the module first and then get the course id
			if (pageInfo.isInCourseModuleLayout) {
				const { id: moduleId } = params as RouteParams<
					"routes/course/module.$id" | "routes/course/module.$id.edit"
				>;

				if (Number.isNaN(moduleId)) return;

				const moduleContext = await tryFindCourseActivityModuleLinkById(
					payload,
					Number(moduleId),
				);

				if (!moduleContext.ok) return;

				const module = moduleContext.value;
				const { course } = module;
				// update the course id to the course id from the module
				courseId = course.id;
			}

			// in course/section/id , we need to get the section first and then get the course id
			if (pageInfo.isCourseSection || pageInfo.isCourseSectionEdit) {
				const { id: sectionId } = pageInfo.isCourseSectionEdit
					? (params as RouteParams<"routes/course/section-edit">)
					: (params as RouteParams<"routes/course/section.$id">);

				if (Number.isNaN(sectionId)) return;

				const sectionContext = await tryFindSectionById({
					payload,
					sectionId: Number(sectionId),
					user: currentUser
						? {
							...currentUser,
							avatar: currentUser?.avatar?.id,
						}
						: null,
				});

				if (!sectionContext.ok) return;

				const section = sectionContext.value;
				// update the course id to the course id from the section
				courseId = section.course;
			}

			const courseContextResult = await tryGetCourseContext(
				payload,
				courseId,
				currentUser || null,
			);

			// Only set the course context if successful
			if (courseContextResult.ok) {
				context.set(courseContextKey, courseContextResult.value);
			} else {
				console.error(courseContextResult.error);
				throw new InternalServerErrorResponse("Failed to get course context");
			}
		}
	},
	// set the course section context
	async ({ context, params }) => {
		const { payload, routeHierarchy } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);

		const currentUser =
			userSession?.effectiveUser || userSession?.authenticatedUser;

		// Check if we're in a course section layout
		if (
			routeHierarchy.some(
				(route) => route.id === "layouts/course-section-layout",
			)
		) {
			// Get section ID from params
			const sectionId = params.id ? Number(params.id) : null;

			if (sectionId && !Number.isNaN(sectionId) && courseContext) {
				const sectionResult = await tryFindSectionById({
					payload,
					sectionId,
					user: currentUser
						? {
							...currentUser,
							avatar: currentUser?.avatar?.id,
						}
						: null,
				});

				if (sectionResult.ok) {
					const courseSectionContextResult =
						await tryGetCourseSectionContext(sectionResult);

					if (courseSectionContextResult.ok) {
						context.set(
							courseSectionContextKey,
							courseSectionContextResult.value,
						);
					}
				}
			}
		}
	},
	// set the user access context
	async ({ context }) => {
		const { payload } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		const currentUser =
			userSession?.effectiveUser || userSession?.authenticatedUser;

		if (userSession?.isAuthenticated && currentUser) {
			const userAccessContext = await getUserAccessContext(
				payload,
				currentUser.id,
				currentUser,
			);
			context.set(userAccessContextKey, userAccessContext);
		}
	},
	// set the user profile context
	async ({ context, params }) => {
		const { payload, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const userAccessContext = context.get(userAccessContextKey);

		const currentUser =
			userSession?.effectiveUser || userSession?.authenticatedUser;

		// Check if we're in a user profile route (user-layout or user/profile)

		if (
			userSession?.isAuthenticated &&
			currentUser &&
			// if user login, he must have user access context
			userAccessContext &&
			(pageInfo.isUserLayout || pageInfo.isUserProfile)
		) {
			// Get the profile user id from params, or use current user id
			const profileUserId = params.id ? Number(params.id) : currentUser.id;

			if (!Number.isNaN(profileUserId)) {
				const userProfileContext =
					profileUserId === currentUser.id
						? convertUserAccessContextToUserProfileContext(
							userAccessContext,
							currentUser,
						)
						: await getUserProfileContext(payload, profileUserId, currentUser);
				context.set(userProfileContextKey, userProfileContext);
			}
		}
	},
	// set the enrolment context
	async ({ context }) => {
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
	// set the course module context
	async ({ context, params }) => {
		const { payload, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);

		// Check if user is authenticated, in a course module, and has course context
		if (
			userSession?.isAuthenticated &&
			pageInfo.isInCourseModuleLayout &&
			courseContext
		) {
			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;

			const { id: moduleId } =
				params as RouteParams<"layouts/course-module-layout">;

			// Get module link ID from params
			if (moduleId && !Number.isNaN(moduleId)) {
				const courseModuleContextResult = await tryGetCourseModuleContext(
					payload,
					Number(moduleId),
					courseContext.courseId,
					currentUser
						? {
							...currentUser,
							avatar: currentUser?.avatar?.id,
						}
						: null,
				);

				if (courseModuleContextResult.ok) {
					context.set(courseModuleContextKey, courseModuleContextResult.value);
				}
			}
		}
	},
	// set the user module context
	async ({ context, params }) => {
		const { payload, routeHierarchy } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// Check if we're in a user module edit layout
		if (
			userSession?.isAuthenticated &&
			routeHierarchy.some(
				(route) => route.id === "layouts/user-module-edit-layout",
			)
		) {
			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;

			// Get module ID from params
			const moduleId = params.moduleId ? Number(params.moduleId) : null;

			if (moduleId && !Number.isNaN(moduleId)) {
				const userModuleContextResult = await tryGetUserModuleContext(
					payload,
					moduleId,
					{
						...currentUser,
						avatar: currentUser?.avatar?.id,
					},
				);

				if (userModuleContextResult.ok) {
					context.set(userModuleContextKey, userModuleContextResult.value);
				}
			}
		}
	},
] satisfies Route.MiddlewareFunction[];

export async function loader({ request, context }: Route.LoaderArgs) {
	const { payload, requestInfo, pageInfo, systemGlobals } =
		context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const timestamp = new Date().toISOString();
	// console.log(routes)
	// ! we can get elysia from context!!!
	// console.log(payload, elysia);
	const result = await tryGetUserCount({ payload, overrideAccess: true });

	if (!result.ok) {
		throw new Error("Failed to get user count");
	}

	const users = result.value;

	// Get current user's theme preference
	const currentUser =
		userSession?.effectiveUser || userSession?.authenticatedUser;
	const theme = currentUser?.theme ?? "light";

	// Check if we need to redirect to first-user creation
	// Skip redirect check for essential routes
	if (pageInfo.isRegistration || pageInfo.isLogin || pageInfo.isApi) {
		return {
			users: users,
			domainUrl: requestInfo.domainUrl,
			timestamp: timestamp,
			pageInfo: pageInfo,
			theme: theme,
			additionalCssStylesheets:
				systemGlobals.appearanceSettings.additionalCssStylesheets,
			additionalJsScripts:
				systemGlobals.analyticsSettings.additionalJsScripts,
		};
	}

	// If no users exist, redirect to first-user creation
	if (users === 0) {
		throw redirect(href("/registration"));
	}

	return {
		users: users,
		domainUrl: requestInfo.domainUrl,
		timestamp: timestamp,
		pageInfo: pageInfo,
		theme: theme,
		isDevelopment: process.env.NODE_ENV === "development",
		additionalCssStylesheets:
			systemGlobals.appearanceSettings.additionalCssStylesheets,
		additionalJsScripts:
			systemGlobals.analyticsSettings.additionalJsScripts,
	};
}

const mantineTheme = createTheme({
	components: {
		Textarea: Textarea.extend({
			defaultProps: {
				minRows: 3,
				autosize: true,
			},
		}),
	},
});

function ClientHintCheck() {
	const { revalidate } = useRevalidator();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		// Revalidate when timezone changes are detected
		// This will be handled by the client hint script automatically
	}, [revalidate]);

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}


function AnalyticsScripts({ scripts }: { scripts: Route.ComponentProps["loaderData"]["additionalJsScripts"] }) {
	return (
		<>
			{scripts.map((script, index) => {
				const scriptProps: Record<string, string | boolean | number> = {
					src: script.src,
				};
				if (script.defer) {
					scriptProps.defer = true;
				}
				if (script.async) {
					scriptProps.async = true;
				}
				// Convert camelCase data attributes to kebab-case HTML attributes
				if (script.dataWebsiteId) {
					scriptProps["data-website-id"] = script.dataWebsiteId;
				}
				if (script.dataDomain) {
					scriptProps["data-domain"] = script.dataDomain;
				}
				if (script.dataSite) {
					scriptProps["data-site"] = script.dataSite;
				}
				if (script.dataMeasurementId) {
					scriptProps["data-measurement-id"] = script.dataMeasurementId;
				}
				// Also handle any other data-* attributes that might exist
				Object.keys(script).forEach((key) => {
					if (
						key.startsWith("data-") &&
						key !== "dataWebsiteId" &&
						key !== "dataDomain" &&
						key !== "dataSite" &&
						key !== "dataMeasurementId"
					) {
						const value = script[key as `data-${string}`];
						if (value !== undefined) {
							scriptProps[key] = value;
						}
					}
				});
				return <script key={`${script.src}-${index}`} {...scriptProps} />;
			})}
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta title="Paideia LMS" />
				<meta name="description" content="Paideia LMS" />
				<ClientHintCheck />
				<link rel="icon" href={`/favicon.ico`} />
				<link
					rel="stylesheet"
					href={`https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css`}
				/>
				<Meta />
				<Links />
				<ColorSchemeScript />
			</head>
			<body style={{ overscrollBehaviorX: "none" }}>
				<MantineProvider>
					<RootErrorBoundary error={error} />
				</MantineProvider>
			</body>
		</html>
	);
}

export default function App({ loaderData }: Route.ComponentProps) {
	const { theme, isDevelopment, additionalCssStylesheets, additionalJsScripts } =
		loaderData;

	return (
		<html
			lang="en"
			data-mantine-color-scheme={theme}
			style={{ overscrollBehaviorX: "none" }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta title="Paideia LMS" />
				<meta name="description" content="Paideia LMS" />
				<ClientHintCheck />
				{/* ! this will force the browser to reload the favicon, see https://stackoverflow.com/questions/2208933/how-do-i-force-a-favicon-refresh */}
				<link
					rel="icon"
					href={`/favicon.ico?timestamp=${loaderData.timestamp}`}
				/>
				<link
					rel="stylesheet"
					href={`https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme === "dark" ? "github-dark" : "github"}.min.css`}
				/>
				{/* Additional CSS stylesheets configured by admin */}
				{additionalCssStylesheets.map((url) => (
					<link key={url} rel="stylesheet" href={url} />
				))}
				{/* Additional JavaScript scripts configured by admin */}
				<AnalyticsScripts scripts={additionalJsScripts} />
				{isDevelopment && (
					<script
						crossOrigin="anonymous"
						src="https://unpkg.com/react-scan/dist/auto.global.js"
					/>
				)}
				{isDevelopment && (
					<script
						src="https://unpkg.com/react-grab/dist/index.global.js"
						crossOrigin="anonymous"
						data-enabled="true"
					/>
				)}
				<Meta />
				<Links />
				<ColorSchemeScript defaultColorScheme={theme} />
			</head>
			<body style={{ overscrollBehaviorX: "none" }}>
				<MantineProvider defaultColorScheme={theme} theme={mantineTheme}>
					<CodeHighlightAdapterProvider adapter={customLowlightAdapter}>
						<ModalsProvider>
							<NuqsAdapter>
								<Outlet />
								<Notifications />
							</NuqsAdapter>
						</ModalsProvider>
					</CodeHighlightAdapterProvider>
				</MantineProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
