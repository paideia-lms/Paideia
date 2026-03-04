import {
	Paideia,
	asciiLogo,
	createOpenApiGenerator,
	createScalarDocsHtml,
	displayHelp,
	envVars,
	getMigrationStatus,
	migrations,
	orpcRouter,
	s3Client,
	tryResetSandbox,
	tryRunSeed,
	S3BucketNotFoundError,
	type Migration as MigrationType,
} from "@paideia/paideia-backend/server";

import { Elysia } from "elysia";
import { RouterContextProvider } from "react-router";
import { createStorage } from "unstorage";
// biome-ignore lint/suspicious/noTsIgnore: unstorage driver types
// @ts-ignore
import lruCacheDriver from "unstorage/drivers/lru-cache";
import { getHints } from "../app/utils/client-hints";
import packageJson from "../package.json";
import { courseContextKey } from "./contexts/course-context";
import { courseModuleContextKey } from "./contexts/course-module-context";
import { courseSectionContextKey } from "./contexts/course-section-context";
import { enrolmentContextKey } from "./contexts/enrolment-context";
import { globalContextKey } from "./contexts/global-context";
import { userContextKey } from "./contexts/user-context";
import { userModuleContextKey } from "./contexts/user-module-context";
import { userProfileContextKey } from "./contexts/user-profile-context";
import { reactRouter } from "./elysia-react-router";
import { parseParams } from "../app/utils/router/route-params-schema";
import prompts from "prompts";
import { getRequestInfo } from "./utils/get-request-info";
import { detectPlatform } from "./utils/hosting-platform-detection";
import vfs from "./vfs";

const paideia = new Paideia();
const payload = await paideia.init();

// Server startup function
async function startServer() {
	console.log(asciiLogo);
	console.log(
		`You are starting the Paideia server (${packageJson.version}). Paideia binary can be used as a CLI application.`,
	);
	displayHelp();

	// Check for pending migrations before any DB-dependent operations
	const migrationStatuses = await getMigrationStatus({
		payload,
		migrations: migrations as MigrationType[],
	});
	const pendingCount = (migrationStatuses ?? []).filter(
		(s) => s.Ran === "No",
	).length;
	if (pendingCount > 0) {
		const isInteractive = Boolean(process.stdin.isTTY);
		if (isInteractive) {
			const { runNow } = await prompts(
				{
					name: "runNow",
					type: "confirm",
					initial: true,
					message: `You have ${pendingCount} pending migration(s). Run them now before starting the server?`,
				},
				{ onCancel: () => process.exit(0) },
			);
			if (!runNow) {
				console.log(
					"Run `bun run migrate:up` to apply migrations, then start the server.",
				);
				process.exit(0);
			}
		} else {
			console.log(
				`Non-interactive mode: applying ${pendingCount} pending migration(s)...`,
			);
		}
		await payload.db.migrate({
			migrations: migrations as MigrationType[],
		});
	}

	const unstorage = createStorage({
		driver: lruCacheDriver({
			max: 1000,
			// how long to live in ms
			ttl: 1000 * 60 * 5,
		}),
	});

	console.log("Mode: ", process.env.NODE_ENV);

	// TODO: we are not running seed in the program anymore , seed should be done outside the program
	if (process.env.NODE_ENV === "development") {
		// ! a system request, so we don't need to provide a request
		const seedResult = await tryRunSeed({
			payload,
			req: undefined,
			overrideAccess: true,
			vfs: vfs as Record<string, string>,
		});
		if (!seedResult.ok) {
			const err = seedResult.error;
			if (err instanceof S3BucketNotFoundError) {
				console.error("\n❌ S3 bucket not found. Cannot proceed with seed.\n");
				console.error(err.message);
				console.error("\nCreate the bucket and try again.\n");
				process.exit(1);
			}
			console.error(`❌ Seed failed: ${err.message}`);
			process.exit(1);
		}
	}
	// Check if sandbox mode is enabled and reset database
	else if (envVars.SANDBOX_MODE.enabled) {
		console.log("🔄 Sandbox mode enabled, resetting database on startup...");
		const resetResult = await tryResetSandbox({
			payload,
			req: undefined,
			overrideAccess: true,
			vfs: vfs as Record<string, string>,
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

	const orpcHandler = paideia.getOpenApiHandler();
	const openApiGenerator = createOpenApiGenerator();

	const getBaseUrl = (request: Request) => {
		const url = new URL(request.url);
		return `${url.origin}/openapi`;
	};

	const handleOpenApiRequest = async (request: Request): Promise<Response> => {
		const pathname = new URL(request.url).pathname;
		const baseUrl = getBaseUrl(request);

		if (pathname === "/openapi/spec.json") {
			const spec = await openApiGenerator.generate(orpcRouter, {
				info: { title: "Paideia LMS API", version: "1.0.0" },
				servers: [{ url: baseUrl }],
			});
			return new Response(JSON.stringify(spec), {
				headers: { "Content-Type": "application/json" },
			});
		}
		if (pathname === "/openapi" || pathname === "/openapi/") {
			return new Response(createScalarDocsHtml(`${baseUrl}/spec.json`), {
				headers: { "Content-Type": "text/html" },
			});
		}
		const { matched, response } = await orpcHandler.handle(request, {
			prefix: "/openapi",
			context: { payload, s3Client },
		});
		return matched ? response : new Response("Not Found", { status: 404 });
	};

	// OpenAPI must run BEFORE reactRouter's catch-all so /openapi/* is not served as SPA.
	// Use onRequest and return Response to short-circuit the pipeline (skip route matching).
	const frontend = new Elysia()
		.onRequest(async ({ request }) => {
			const pathname = new URL(request.url).pathname;
			if (!pathname.startsWith("/openapi")) return;

			const response = await handleOpenApiRequest(request);
			return response;
		})
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


	return { frontend };
}

// Configure Commander.js program with all CLI commands
const program = await paideia.configureCommands();

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
export type Frontend = Awaited<ReturnType<typeof startServer>>["frontend"];

await program.parseAsync();
