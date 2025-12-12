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
import "@gfazioli/mantine-json-tree/styles.css";
import "@gfazioli/mantine-clock/styles.css";

import { CodeHighlightAdapterProvider } from "@mantine/code-highlight";
import {
	ColorSchemeScript,
	createTheme,
	DirectionProvider,
	MantineProvider,
	Textarea,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
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
import { tryGetUserCount } from "server/internal/user-management";
import { tryFindCourseActivityModuleLinkById } from "server/internal/course-activity-module-link-management";
import { tryFindSectionById } from "server/internal/course-section-management";
import { tryGetSystemGlobals } from "server/internal/system-globals";
import { DevTool } from "./components/dev-tool";
import { RootErrorBoundary } from "./components/root-mode-error-boundary";
import { SandboxCountdown } from "./components/sandbox-countdown";
import { hintsUtils } from "./utils/client-hints";
import { customLowlightAdapter } from "./utils/lowlight-adapter";
import {
	InternalServerErrorResponse,
	MaintenanceModeResponse,
} from "./utils/responses";
import { type RouteParams, tryGetRouteHierarchy } from "./utils/routes-utils";
import { parseAsInteger, createLoader } from "nuqs/server";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

const searchParams = {
	threadId: parseAsInteger,
};
export const loadSearchParams = createLoader(searchParams);

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
		let isCourseGradesSingleView = false;
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
		let isAdminScheduledTasks = false;
		let isAdminMaintenance = false;
		let isAdminSitePolicies = false;
		let isAdminMedia = false;
		let isAdminAppearance = false;
		let isAdminTheme = false;
		let isAdminLogo = false;
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
			else if (route.id === "routes/course.$id.grades.singleview")
				isCourseGradesSingleView = true;
			else if (route.id === "routes/course.$id.modules") isCourseModules = true;
			else if (route.id === "routes/course.$id.bin") isCourseBin = true;
			else if (route.id === "routes/course.$id.backup") isCourseBackup = true;
			else if (route.id === "routes/course/module.$id/route")
				isCourseModule = true;
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
			else if (route.id === "routes/admin/scheduled-tasks")
				isAdminScheduledTasks = true;
			else if (route.id === "routes/admin/maintenance")
				isAdminMaintenance = true;
			else if (route.id === ("routes/admin/sitepolicies" as typeof route.id))
				isAdminSitePolicies = true;
			else if (route.id === "routes/admin/media") isAdminMedia = true;
			else if (route.id === ("routes/admin/appearance" as typeof route.id))
				isAdminAppearance = true;
			else if (
				route.id === ("routes/admin/appearance/theme" as typeof route.id)
			)
				isAdminTheme = true;
			else if (route.id === ("routes/admin/appearance/logo" as typeof route.id))
				isAdminLogo = true;
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
				isCourseGradesSingleView,
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
				isAdminScheduledTasks,
				isAdminMaintenance,
				isAdminSitePolicies,
				isAdminMedia,
				isAdminAppearance,
				isAdminTheme,
				isAdminLogo,
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

		const userSession = await tryGetUserContext({
			payload,
			// ! we need to create local request here because user is not set 
			req: createLocalReq({ request, context: { routerContext: context } }),
		});

		// Set the user context
		context.set(userContextKey, userSession);
	},
	/**
	 * set the payload request to the global context
	 */
	async ({ request, context }) => {
		const userSession = context.get(userContextKey);
		const currentUser =
			userSession?.effectiveUser ?? userSession?.authenticatedUser;
		// ! we need to create local request here because we now know whether user is authenticated or not
		const payloadRequest = createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		});
		context.set(globalContextKey, {
			...context.get(globalContextKey),
			payloadRequest,
		});
	},
	/**
	 * Fetch system globals (maintenance mode, site policies, etc.) and check maintenance mode
	 */
	async ({ context }) => {
		const { payload, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// Fetch all system globals in one call
		const systemGlobals = await tryGetSystemGlobals({
			payload,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		}).getOrDefault({
			maintenanceSettings: { maintenanceMode: false },
			sitePolicies: {
				userMediaStorageTotal: null,
				siteUploadLimit: null,
			},
			appearanceSettings: {
				additionalCssStylesheets: [],
				color: "blue",
				radius: "sm" as const,
				logoLight: null,
				logoDark: null,
				compactLogoLight: null,
				compactLogoDark: null,
				faviconLight: null,
				faviconDark: null,
			},
			analyticsSettings: {
				additionalJsScripts: [],
			},
		});

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
	async ({ context, params, request }) => {
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);

		// check if the user is in a course
		if (pageInfo.isInCourse) {
			// const { moduleLinkId, sectionId, courseId } = params as RouteParams<"layouts/course-layout">;
			const { courseId: _courseId } =
				params as RouteParams<"layouts/course-layout">;
			let courseId = Number.isNaN(_courseId) ? null : Number(_courseId);
			// in course/module/id , we need to get the module first and then get the course id
			if (pageInfo.isInCourseModuleLayout) {
				const { moduleLinkId } =
					params as RouteParams<"layouts/course-module-layout">;
				if (Number.isNaN(moduleLinkId)) return;

				const moduleContext = await tryFindCourseActivityModuleLinkById({
					payload,
					linkId: Number(moduleLinkId),
					req: payloadRequest,
				});

				if (!moduleContext.ok) return;

				const module = moduleContext.value;
				const { course } = module;
				// update the course id to the course id from the module
				courseId = course.id;
			}

			// in course/section/id , we need to get the section first and then get the course id
			if (pageInfo.isCourseSection || pageInfo.isCourseSectionEdit) {
				const { sectionId } =
					params as RouteParams<"layouts/course-section-layout">;

				if (Number.isNaN(sectionId)) return;

				const sectionContext = await tryFindSectionById({
					payload,
					sectionId: Number(sectionId),
					req: payloadRequest,
				});

				if (!sectionContext.ok) return;

				const section = sectionContext.value;
				// update the course id to the course id from the section
				courseId = section.course.id;
			}

			// if course id is not set, something is wrong, log it and leave context unset
			if (!courseId) {
				payload.logger.error("Course ID is not set, something is wrong");
				return;
			}

			const courseContextResult = await tryGetCourseContext({
				payload,
				req: payloadRequest,
				courseId: courseId,
			}).getOrElse((error) => {
				throw new InternalServerErrorResponse("Failed to get course context");
			})
			// FIXME: fix this type error
			context.set(courseContextKey, courseContextResult);
		}
	},
	// set the course section context
	async ({ context, params, request }) => {
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);

		// Check if we're in a course section layout
		if (pageInfo.isInCourseSectionLayout) {
			// Get section ID from params
			const { sectionId } =
				params as RouteParams<"layouts/course-section-layout">;

			if (Number.isNaN(sectionId)) return;

			if (courseContext) {
				const courseSectionContextResult = await tryGetCourseSectionContext({
					payload,
					req: payloadRequest,
					sectionId: Number(sectionId),
				});

				if (courseSectionContextResult.ok) {
					context.set(
						courseSectionContextKey,
						courseSectionContextResult.value,
					);
				}
			}
		}
	},
	// set the user access context
	async ({ context, request }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		const currentUser =
			userSession?.effectiveUser || userSession?.authenticatedUser;

		if (userSession?.isAuthenticated && currentUser) {
			const userAccessContext = await getUserAccessContext({
				payload,
				userId: currentUser.id,
				req: payloadRequest,
			});
			context.set(userAccessContextKey, userAccessContext);
		}
	},
	// set the user profile context
	async ({ context, params, request }) => {
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);
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
						: await getUserProfileContext({
							payload,
							profileUserId,
							req: payloadRequest,
							overrideAccess: false,
						});
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
				(e) => e.user.id === currentUser?.id,
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
	async ({ context, params, request }) => {
		// get the enrolment context
		const enrolmentContext = context.get(enrolmentContextKey);
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);

		// Check if user is authenticated, in a course module, and has course context
		if (
			userSession?.isAuthenticated &&
			pageInfo.isInCourseModuleLayout &&
			courseContext
		) {
			const { moduleLinkId } =
				params as RouteParams<"layouts/course-module-layout">;

			// Get module link ID from params
			if (moduleLinkId && !Number.isNaN(moduleLinkId)) {
				// Extract threadId from URL search params if present
				const { threadId } = loadSearchParams(request);

				const courseModuleContext = await tryGetCourseModuleContext({
					payload,
					moduleLinkId: Number(moduleLinkId),
					courseId: courseContext.courseId,
					enrolment: enrolmentContext?.enrolment ?? null,
					threadId: threadId !== null ? String(threadId) : null,
					req: payloadRequest,
				}).getOrNull()

				if (courseModuleContext) {
					context.set(courseModuleContextKey, courseModuleContext);
				}
			}
		}
	},
	// set the user module context
	async ({ context, params, request }) => {
		const { payload, routeHierarchy, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		// Check if we're in a user module edit layout
		if (
			userSession?.isAuthenticated &&
			routeHierarchy.some(
				(route) => route.id === "layouts/user-module-edit-layout",
			)
		) {
			// Get module ID from params
			const moduleId = params.moduleId ? Number(params.moduleId) : null;

			if (moduleId && !Number.isNaN(moduleId)) {
				const userModuleContext = await tryGetUserModuleContext({
					payload,
					moduleId,
					req: payloadRequest,
				}).getOrNull()

				if (userModuleContext) {
					context.set(userModuleContextKey, userModuleContext);
				}
			}
		}
	},
] satisfies Route.MiddlewareFunction[];

export async function loader({ context }: Route.LoaderArgs) {
	const {
		environment,
		payload,
		requestInfo,
		pageInfo,
		systemGlobals,
		envVars,
	} = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const timestamp = new Date().toISOString();
	// console.log(routes)
	// ! we can get elysia from context!!!
	// console.log(payload, elysia);
	const userCount = await tryGetUserCount({ payload, overrideAccess: true }).getOrElse(() => {
		throw new InternalServerErrorResponse("Failed to get user count");
	})

	// Get current user's theme and direction preference
	const currentUser =
		userSession?.effectiveUser || userSession?.authenticatedUser;
	const theme = currentUser?.theme ?? "light";
	const direction = currentUser?.direction ?? "ltr";

	// Get theme settings from appearance settings
	const primaryColor = systemGlobals.appearanceSettings.color ?? "blue";
	const defaultRadius = systemGlobals.appearanceSettings.radius ?? "sm";

	// Get logo and favicon media objects directly from system globals based on theme
	const logoMedia =
		theme === "dark"
			? (systemGlobals.appearanceSettings.logoDark ?? null)
			: (systemGlobals.appearanceSettings.logoLight ?? null);
	const faviconMedia =
		theme === "dark"
			? (systemGlobals.appearanceSettings.faviconDark ?? null)
			: (systemGlobals.appearanceSettings.faviconLight ?? null);

	// Check if sandbox mode is enabled and calculate next reset time
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;
	let nextResetTime: string | null = null;
	if (isSandboxMode) {
		// Calculate next midnight (00:00:00)
		const now = new Date();
		const nextMidnight = new Date(now);
		nextMidnight.setHours(24, 0, 0, 0); // Set to next midnight
		nextResetTime = nextMidnight.toISOString();
	}

	// Check if we need to redirect to first-user creation
	// Skip redirect check for essential routes
	if (pageInfo.isRegistration || pageInfo.isLogin || pageInfo.isApi) {
		return {
			users: userCount,
			domainUrl: requestInfo.domainUrl,
			timestamp: timestamp,
			pageInfo: pageInfo,
			theme: theme,
			direction: direction,
			primaryColor,
			defaultRadius,
			additionalCssStylesheets:
				systemGlobals.appearanceSettings.additionalCssStylesheets,
			additionalJsScripts: systemGlobals.analyticsSettings.additionalJsScripts,
			logoMedia,
			faviconMedia,
			isSandboxMode,
			nextResetTime,
		};
	}

	// If no users exist, redirect to first-user creation
	if (userCount === 0) {
		throw redirect(href("/registration"));
	}

	return {
		users: userCount,
		domainUrl: requestInfo.domainUrl,
		timestamp: timestamp,
		pageInfo: pageInfo,
		theme: theme,
		direction: direction,
		isDevelopment: environment === "development",
		primaryColor,
		defaultRadius,
		additionalCssStylesheets:
			systemGlobals.appearanceSettings.additionalCssStylesheets,
		additionalJsScripts: systemGlobals.analyticsSettings.additionalJsScripts,
		logoMedia,
		faviconMedia,
		debugData: environment !== "development" ? null : {
			userSession: userSession,
			courseContext: context.get(courseContextKey),
			courseModuleContext: context.get(courseModuleContextKey),
			courseSectionContext: context.get(courseSectionContextKey),
			enrolmentContext: context.get(enrolmentContextKey),
			userModuleContext: context.get(userModuleContextKey),
			userProfileContext: context.get(userProfileContextKey),
			userAccessContext: context.get(userAccessContextKey),
			userContext: context.get(userContextKey),
			systemGlobals: systemGlobals,
		},
		isSandboxMode,
		nextResetTime,
	};
}

// Theme will be created dynamically in the App component

function ClientHintCheck() {
	const { revalidate } = useRevalidator();

	// biome-ignore lint/correctness/useExhaustiveDependencies: revalidate is stable
	useEffect(() => {
		// Revalidate when timezone changes are detected
		// This will be handled by the client hint script automatically
	}, [revalidate]);

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: client hint script is safe
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}

function AnalyticsScripts({
	scripts,
}: {
	scripts: Route.ComponentProps["loaderData"]["additionalJsScripts"];
}) {
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
		<html lang="en" dir="ltr">
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
				<DirectionProvider initialDirection="ltr" detectDirection={false}>
					<MantineProvider>
						<RootErrorBoundary error={error} />
					</MantineProvider>
				</DirectionProvider>
			</body>
		</html>
	);
}

export default function App({ loaderData }: Route.ComponentProps) {
	const {
		theme,
		direction,
		isDevelopment,
		additionalCssStylesheets,
		additionalJsScripts,
		primaryColor,
		defaultRadius,
		debugData,
		isSandboxMode,
		nextResetTime,
	} = loaderData;

	// Create theme dynamically with color and radius from appearance settings
	const mantineTheme = createTheme({
		primaryColor: primaryColor as
			| "blue"
			| "pink"
			| "indigo"
			| "green"
			| "orange"
			| "gray"
			| "grape"
			| "cyan"
			| "lime"
			| "red"
			| "violet"
			| "teal"
			| "yellow",
		defaultRadius: defaultRadius as "xs" | "sm" | "md" | "lg" | "xl",
		components: {
			Textarea: Textarea.extend({
				defaultProps: {
					minRows: 3,
					autosize: true,
				},
			}),
		},
	});

	return (
		<html
			lang="en"
			dir={direction}
			data-mantine-color-scheme={theme}
			style={{ overscrollBehaviorX: "none" }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta title="Paideia LMS" />
				<meta name="description" content="Paideia LMS" />
				<ClientHintCheck />
				{/* Favicon based on theme */}
				{loaderData.faviconMedia?.filename ? (
					<link
						rel="icon"
						href={
							href(`/api/media/file/:filenameOrId`, {
								filenameOrId: loaderData.faviconMedia.filename,
							}) + `?timestamp=${loaderData.timestamp}`
						}
					/>
				) : (
					<link
						rel="icon"
						href={`/favicon.ico?timestamp=${loaderData.timestamp}`}
					/>
				)}
				<link
					rel="stylesheet"
					href={`https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme === "dark" ? "github-dark" : "github"}.min.css`}
				/>
				{/* Additional CSS stylesheets configured by admin */}
				{additionalCssStylesheets.map((stylesheet) => (
					<link key={stylesheet.id} rel="stylesheet" href={stylesheet.url} />
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
				<DirectionProvider initialDirection={direction} detectDirection={false}>
					<MantineProvider defaultColorScheme={theme} theme={mantineTheme}>
						<CodeHighlightAdapterProvider adapter={customLowlightAdapter}>
							<ModalsProvider>
								<NuqsAdapter>
									<Outlet />
									<Notifications />
									{isDevelopment && <DevTool data={debugData} />}
									{isSandboxMode && nextResetTime && (
										<SandboxCountdown nextResetTime={nextResetTime} />
									)}
								</NuqsAdapter>
							</ModalsProvider>
						</CodeHighlightAdapterProvider>
					</MantineProvider>
				</DirectionProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
