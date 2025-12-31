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
import {
	globalContextKey,
	type PageInfo,
} from "server/contexts/global-context";
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
import {
	type RouteId,
	type RouteParams,
	tryGetRouteHierarchy,
} from "./utils/routes-utils";
import { parseAsInteger, createLoader } from "nuqs/server";
import { createLocalReq } from "server/internal/utils/internal-function-utils";
import { parseParams } from "app/utils/params-schema";

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
		const parsedParams = parseParams(params);
		const is: PageInfo["is"] = Object.fromEntries(
			routeHierarchy.map((route) => [
				route.id,
				{ params: parsedParams as RouteParams<RouteId> },
			]),
		) as PageInfo["is"];

		// set the route hierarchy and page info to the context
		context.set(globalContextKey, {
			...context.get(globalContextKey),
			routeHierarchy,
			pageInfo: {
				is: is,
				params: parsedParams,
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


			if (
				pageInfo.is["routes/login"] ||
				pageInfo.is["routes/admin/maintenance"] ||
				Object.keys(pageInfo.is).some((id) =>
					id.startsWith("routes/api/"),
				)
			) {
				return;
			}

			// Block non-admin users
			if (!currentUser || currentUser.role !== "admin") {
				// If we're already on the root route, throw error instead of redirecting
				if (pageInfo.is["routes/index"]) {
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
		if (pageInfo.is["layouts/course-layout"]) {
			// const { moduleLinkId, sectionId, courseId } = params as RouteParams<"layouts/course-layout">;
			let courseId = 	pageInfo.is["layouts/course-layout"].params.courseId ?? null 
			// in course/module/id , we need to get the module first and then get the course id
			if (pageInfo.is["layouts/course-module-layout"]) {
				const { moduleLinkId } =
					pageInfo.is["layouts/course-module-layout"].params;
				const moduleContext = await tryFindCourseActivityModuleLinkById({
					payload,
					linkId: moduleLinkId,
					req: payloadRequest,
				});

				if (!moduleContext.ok) return;

				const module = moduleContext.value;
				const { course } = module;
				// update the course id to the course id from the module
				courseId = course.id;
			}

			// in course/section/id , we need to get the section first and then get the course id
			if (pageInfo.is["layouts/course-section-layout"]) {
				const { sectionId } = pageInfo.is["layouts/course-section-layout"].params;

				const sectionContext = await tryFindSectionById({
					payload,
					sectionId: sectionId,
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
			});
			// FIXME: fix this type error
			context.set(courseContextKey, courseContextResult);
		}
	},
	// set the course section context
	async ({ context, params, request }) => {
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);
		const courseContext = context.get(courseContextKey);

		// Check if we're in a course section layout
		if (pageInfo.is["layouts/course-section-layout"]) {
			// Get section ID from params
			const { sectionId } = pageInfo.is["layouts/course-section-layout"].params;
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
			(pageInfo.is["layouts/user-layout"] || pageInfo.is["routes/user/profile"])
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
		const courseContext = context.get(courseContextKey);
		if (courseContext) {
			const enrollment = courseContext.enrolment;

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
		const { payload, pageInfo, payloadRequest } = context.get(globalContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);

		// Check if user is authenticated, in a course module, and has course context
		if (
			userSession?.isAuthenticated &&
			pageInfo.is["layouts/course-module-layout"] &&
			courseContext
		) {
			const { moduleLinkId } = pageInfo.is["layouts/course-module-layout"].params;

			// Get module link ID from params
				// Extract threadId from URL search params if present
				const { threadId } = loadSearchParams(request);

				const courseModuleContext = await tryGetCourseModuleContext({
					payload,
					moduleLinkId: moduleLinkId,
					courseId: courseContext.courseId,
					enrolment: enrolmentContext?.enrolment ?? null,
					threadId: threadId !== null ? String(threadId) : null,
					req: payloadRequest,
				}).getOrNull();

				if (courseModuleContext) {
					context.set(courseModuleContextKey, courseModuleContext);
				}
		}
	},
	// set the user module context
	async ({ context, params, request }) => {
		const { payload, routeHierarchy, payloadRequest } =
			context.get(globalContextKey);
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
				}).getOrNull();

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
	const userCount = await tryGetUserCount({
		payload,
		overrideAccess: true,
	}).getOrElse(() => {
		throw new InternalServerErrorResponse("Failed to get user count");
	});

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
	const isApi = Object.keys(pageInfo.is).some((id) =>
		id.startsWith("routes/api/"),
	);
	if (
		pageInfo.is["routes/registration"] ||
		pageInfo.is["routes/login"] ||
		isApi
	) {
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
		debugData:
			environment !== "development"
				? null
				: {
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
				{loaderData.faviconMedia?.id ? (
					<link
						rel="icon"
						href={
							href(`/api/media/file/:mediaId`, {
								mediaId: loaderData.faviconMedia.id.toString(),
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
