import {
	Paideia,
	asciiLogo,
	displayHelp,
	envVars,
	s3Client,
} from "@paideia/paideia-backend";

import { RouterContextProvider } from "react-router";
import { createRequestHandler } from "react-router";
import { createStorage } from "unstorage";
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
import { parseParams } from "../app/utils/router/route-params-schema";
import { createDevServer } from "./dev-server";
import { getServerBuild, setVite } from "./server-build-access";
import { serveFromVfs } from "./static/serve-vfs";
import prompts from "prompts";
import type { Command } from "commander";
import type { PackageJson } from "type-fest";
import { getRequestInfo } from "./utils/get-request-info";
import { detectPlatform } from "./utils/hosting-platform-detection";
import vfs from "./vfs";

const paideia = new Paideia();
await paideia.init();

const logger = paideia.getPayload().logger;

// Server startup function
async function startServer() {
	console.log(asciiLogo);
	logger.info(
		`You are starting the Paideia server (${packageJson.version}). Paideia binary can be used as a CLI application.`,
	);
	displayHelp();

	// Check for pending migrations before any DB-dependent operations
	const migrationStatuses = await paideia.getMigrationStatus();
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
				logger.info(
					"Run `bun run migrate:up` to apply migrations, then start the server.",
				);
				process.exit(0);
			}
		} else {
			logger.info(
				`Non-interactive mode: applying ${pendingCount} pending migration(s)...`,
			);
		}
		await paideia.migrate();
	}

	const unstorage = createStorage({
		driver: lruCacheDriver({
			max: 1000,
			// how long to live in ms
			ttl: 1000 * 60 * 5,
		}),
	});

	logger.info(`Mode: ${process.env.NODE_ENV}`);

	// TODO: we are not running seed in the program anymore , seed should be done outside the program
	// if (process.env.NODE_ENV === "development") {
	// 	// ! a system request, so we don't need to provide a request
	// 	const seedResult = await tryRunSeed({
	// 		pa: paideia.getPayload(),
	// 		req: undefined,
	// 		overrideAccess: true,
	// 		vfs: vfs as Record<string, string>,
	// 	});
	// 	if (!seedResult.ok) {
	// 		const err = seedResult.error;
	// 		if (err instanceof S3BucketNotFoundError) {
	// 			console.error("\n❌ S3 bucket not found. Cannot proceed with seed.\n");
	// 			console.error(err.message);
	// 			console.error("\nCreate the bucket and try again.\n");
	// 			process.exit(1);
	// 		}
	// 		console.error(`❌ Seed failed: ${err.message}`);
	// 		process.exit(1);
	// 	}
	// }
	// Check if sandbox mode is enabled and reset database
	// else if (envVars.SANDBOX_MODE.enabled) {
	// 	console.log("🔄 Sandbox mode enabled, resetting database on startup...");
	// 	const resetResult = await paideia.tryResetSandbox({
	// 		vfs: vfs as Record<string, string>,
	// 	});
	// 	if (!resetResult.ok) {
	// 		// crash the server
	// 		console.error(
	// 			`❌ Failed to reset sandbox database: ${resetResult.error.message}. There can be bugs with this version. Please turn off sandbox mode and try the normal mode.`,
	// 		);
	// 		process.exit(1);
	// 	}
	// } else {
	await paideia.migrate();
	// }

	const frontendPort =
		Number(envVars.FRONTEND_PORT.value) || envVars.FRONTEND_PORT.default;

	// Detect platform info once at startup
	const platformInfo = detectPlatform();

	// Get Bun version and revision
	const bunVersion = typeof Bun !== "undefined" ? Bun.version : "unknown";
	const bunRevision = typeof Bun !== "undefined" ? Bun.revision : "unknown";
	const packageVersion = packageJson.version;

	function buildLoadContext(
		request: Request,
		serverBuild: Awaited<ReturnType<typeof getServerBuild>>,
	): RouterContextProvider {
		const c = new RouterContextProvider();
		// ! patch the request
		(request as Request & { _c?: RouterContextProvider })._c = c;
		const requestInfo = getRequestInfo(request);
		const hints = getHints(request);

		const requestContext = paideia.createRequestContext({
			request,
			user: null,
			context: { routerContext: c },
		});
		c.set(globalContextKey, {
			serverBuild,
			environment: process.env.NODE_ENV,
			paideia,
			requestInfo,
			s3Client,
			unstorage,
			envVars: envVars,
			platformInfo,
			bunVersion,
			bunRevision,
			packageVersion,
			hints,
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
			requestContext,
			pageInfo: {
				is: {} as any,
				params: parseParams({}),
			},
		});
		c.set(userContextKey, null);
		c.set(courseContextKey, null);
		c.set(enrolmentContextKey, null);
		c.set(courseModuleContextKey, null);
		c.set(courseSectionContextKey, null);
		c.set(userProfileContextKey, null);
		c.set(userModuleContextKey, null);
		return c;
	}

	if (process.env.ENV === "production") {
		setVite(undefined);
		const server = Bun.serve({
			port: frontendPort,
			async fetch(request: Request) {
				const pathname = new URL(request.url).pathname;
				if (pathname.startsWith("/openapi")) {
					return paideia.handleOpenApiRequest(request);
				}
				const vfsResponse = await serveFromVfs(
					request,
					vfs as Record<string, string>,
					{
						maxAge: 31536000,
					},
				);
				if (vfsResponse) return vfsResponse;
				const serverBuild = await getServerBuild();
				const handler = createRequestHandler(serverBuild, "production");
				const loadContext = buildLoadContext(request, serverBuild);
				return handler(request, loadContext);
			},
		});
		paideia
			.getPayload()
			.logger.info(`🚀 Paideia frontend is running at ${server.url}`);
	} else {
		await createDevServer({
			port: frontendPort,
			handleOpenApiRequest: (request) => paideia.handleOpenApiRequest(request),
			buildLoadContext,
			logger: paideia.getPayload().logger,
		});
	}

	await new Promise(() => {}); // keep process alive
}

// Configure CLI with trpc-cli (oRPC-based)
const cli = await paideia.createCli({
	name: "paideia",
	version: packageJson.version,
	description: packageJson.description,
	packageJson: packageJson as PackageJson,
});
const program = cli.buildProgram() as Command;

// Server command - never resolves so process stays alive
program
	.command("server")
	.description("Start the Paideia server")
	.action(startServer);

// Default action: run server if no command provided
program.action(startServer);

await program.parseAsync();
process.exit(0);
