import { envVars, validateEnvVars } from "./env";

// ! every env below this already have been validated in the server/env.ts file
validateEnvVars();

import { treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { getPayload, type Migration as MigrationType } from "payload";
import { RouterContextProvider } from "react-router";
import { migrations } from "src/migrations";
import { createStorage } from "unstorage";
// biome-ignore lint/suspicious/noTsIgnore: unstorage driver types
// @ts-ignore
import lruCacheDriver from "unstorage/drivers/lru-cache";
import { getHints } from "../app/utils/client-hints";
import packageJson from "../package.json";
import { configureCommands, displayHelp } from "./cli/commands";
import { courseContextKey } from "./contexts/course-context";
import { courseModuleContextKey } from "./contexts/course-module-context";
import { courseSectionContextKey } from "./contexts/course-section-context";
import { enrolmentContextKey } from "./contexts/enrolment-context";
import { globalContextKey } from "./contexts/global-context";
import { userAccessContextKey } from "./contexts/user-access-context";
import { userContextKey } from "./contexts/user-context";
import { userModuleContextKey } from "./contexts/user-module-context";
import { userProfileContextKey } from "./contexts/user-profile-context";
import { reactRouter } from "./elysia-react-router";
import sanitizedConfig from "./payload.config";
import { asciiLogo } from "./utils/constants";
import { tryResetSandbox } from "./utils/db/sandbox-reset";
import { tryRunSeed } from "./utils/db/seed";
import { getRequestInfo } from "./utils/get-request-info";
import { detectPlatform } from "./utils/hosting-platform-detection";
import { s3Client } from "./utils/s3-client";
import { parseParams } from "app/utils/route-params-schema";

const payload = await getPayload({
	config: sanitizedConfig,
	cron: true,
	key: "paideia",
});

// Server startup function
async function startServer() {
	console.log(asciiLogo);
	console.log(
		`You are starting the Paideia server (${packageJson.version}). Paideia binary can be used as a CLI application.`,
	);
	displayHelp();

	const unstorage = createStorage({
		driver: lruCacheDriver({
			max: 1000,
			// how long to live in ms
			ttl: 1000 * 60 * 5,
		}),
	});

	console.log("Mode: ", process.env.NODE_ENV);

	if (process.env.NODE_ENV === "development") {
		// ! a system request, so we don't need to provide a request
		await tryRunSeed({ payload, req: undefined, overrideAccess: true });
	}
	// Check if sandbox mode is enabled and reset database
	else if (envVars.SANDBOX_MODE.enabled) {
		console.log("🔄 Sandbox mode enabled, resetting database on startup...");
		const resetResult = await tryResetSandbox({
			payload,
			req: undefined,
			overrideAccess: true,
		});
		if (!resetResult.ok) {
			// crash the server
			console.error(
				`❌ Failed to reset sandbox database: ${resetResult.error.message}. There can be bugs with this version. Please turn off sandbox mode and try the normal mode.`,
			);
			process.exit(1);
		}
	} else {
		await payload.db.migrate({
			migrations: migrations as MigrationType[],
		});
	}

	const port = Number(envVars.PORT.value) || envVars.PORT.default;
	const frontendPort =
		Number(envVars.FRONTEND_PORT.value) || envVars.FRONTEND_PORT.default;

	// Detect platform info once at startup
	const platformInfo = detectPlatform();

	// Get Bun version and revision
	const bunVersion = typeof Bun !== "undefined" ? Bun.version : "unknown";
	const bunRevision = typeof Bun !== "undefined" ? Bun.revision : "unknown";
	const packageVersion = packageJson.version;

	const backend = new Elysia()
		.state("payload", payload)
		.use(openapi())
		.listen(port, () => {
			console.log(`🚀 Paideia backend is running at http://localhost:${port}`);
		});

	const frontend = new Elysia()
		.use(
			async (e) =>
				await reactRouter(e, {
					getLoadContext: ({ request, params }) => {
						const c = new RouterContextProvider();

						// ! patch the request
						request._c = c;
						const requestInfo = getRequestInfo(request);
						const hints = getHints(request);

						c.set(globalContextKey, {
							environment: process.env.NODE_ENV,
							payload: payload,
							elysia: backend,
							api,
							requestInfo,
							s3Client,
							unstorage,
							envVars: envVars,
							platformInfo,
							bunVersion,
							bunRevision,
							packageVersion,
							hints,
							// some fake data for now
							routeHierarchy: [],
							systemGlobals: {
								maintenanceSettings: { maintenanceMode: false },
								sitePolicies: {
									userMediaStorageTotal: null,
									siteUploadLimit: null,
								},
								appearanceSettings: {
									additionalCssStylesheets: [],
									color: "blue",
									radius: "sm",
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
							},
							// ! for now the payload request does not exist because it only exists after the user middleware is passed. we use a temp value here
							payloadRequest: {},
							pageInfo: {
								is: {} as any,
								params: parseParams(params),
							},
						});
						// set all the contexts to be null in the beginning??
						c.set(userContextKey, null);
						c.set(courseContextKey, null);
						c.set(enrolmentContextKey, null);
						c.set(courseModuleContextKey, null);
						c.set(courseSectionContextKey, null);
						c.set(userAccessContextKey, null);
						c.set(userProfileContextKey, null);
						c.set(userModuleContextKey, null);
						return c;
					},
				}),
		)
		.listen(frontendPort, () => {
			console.log(
				`🚀 Paideia frontend is running at http://localhost:${frontendPort}`,
			);
		});

	const api = treaty(backend);

	return { backend, frontend, api };
}

// Configure Commander.js program with all CLI commands
const program = configureCommands(payload);

// Server command
program
	.command("server")
	.description("Start the Paideia server")
	.action(async () => {
		await startServer();
	});

// Default action: run server if no command provided
// This will run when no subcommand is given
program.action(async () => {
	await startServer();
});

// Export types - will be properly typed when server runs
// Using type inference from actual instances
export type Backend = Awaited<ReturnType<typeof startServer>>["backend"];
export type Frontend = Awaited<ReturnType<typeof startServer>>["frontend"];
export type Api = Awaited<ReturnType<typeof startServer>>["api"];

await program.parseAsync();
