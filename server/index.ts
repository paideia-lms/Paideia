import { envVars, validateEnvVars } from "./env";

// ! every env below this already have been validated in the server/env.ts file
validateEnvVars();

import { treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { Command } from "commander";
import { Table } from "console-table-printer";
import { Elysia } from "elysia";
import { getPayload, type Migration as MigrationType } from "payload";
import { RouterContextProvider } from "react-router";
import { migrations } from "src/migrations";
import { createStorage } from "unstorage";
// @ts-ignore this is okay 
import lruCacheDriver from "unstorage/drivers/lru-cache";
import { getHints } from "../app/utils/client-hints";
import packageJson from "../package.json";
import { deleteEverythingInBucket } from "../scripts/clean-s3";
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
import { runSeed } from "./utils/db/seed";
import { asciiLogo } from "./utils/constants";
import { migrateFresh } from "./utils/db/migrate-fresh";
import { tryResetSandbox } from "./utils/db/sandbox-reset";
import {
	getMigrationStatus,
	printMigrationStatus,
} from "./utils/db/migration-status";
import { dumpDatabase } from "./utils/db/dump";
import { getRequestInfo } from "./utils/get-request-info";
import { detectPlatform } from "./utils/hosting-platform-detection";
import { s3Client } from "./utils/s3-client";

const payload = await getPayload({
	config: sanitizedConfig,
	cron: false,
	key: "paideia",
});

function displayHelp() {
	const table = new Table({
		title: "Paideia CLI Commands",
		columns: [
			{ name: "Command", alignment: "left" },
			{ name: "Description", alignment: "left" },
		],
	});
	table.addRow({
		Command: "paideia help",
		Description: "Show help",
	});
	table.addRow({
		Command: "paideia server",
		Description: "Start the Paideia server",
	});
	table.addRow({
		Command: "paideia migrate status",
		Description: "Show migration status",
	});
	table.addRow({
		Command: "paideia migrate up",
		Description: "Run pending migrations",
	});
	table.addRow({
		Command: "paideia migrate fresh",
		Description:
			"Drop all database entities and re-run migrations from scratch",
	});
	table.addRow({
		Command: "paideia migrate dump",
		Description: "Dump database to SQL file",
	});
	table.printTable();
}

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


	// console.log("Payload: ", payload)
	if (process.env.NODE_ENV === "development") {
		await runSeed({ payload });
	}
	// Check if sandbox mode is enabled and reset database
	else if (envVars.SANDBOX_MODE.enabled) {
		console.log("🔄 Sandbox mode enabled, resetting database on startup...");
		const resetResult = await tryResetSandbox(payload);
		if (!resetResult.ok) {
			// crash the server
			console.error(
				`❌ Failed to reset sandbox database: ${resetResult.error.message}`,
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
					getLoadContext: ({ request }) => {
						const c = new RouterContextProvider();
						const requestInfo = getRequestInfo(request);
						const hints = getHints(request);
						c.set(globalContextKey, {
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
							hints,
							// some fake data for now
							routeHierarchy: [],
							pageInfo: {
								isInAdminLayout: false,
								isMyCourses: false,
								isDashboard: false,
								isLogin: false,
								isRegistration: false,
								isCatalog: false,
								isInCourse: false,
								isCourseSettings: false,
								isCourseParticipants: false,
								isCourseParticipantsProfile: false,
								isCourseParticipantsLayout: false,
								isCourseGroups: false,
								isCourseGrades: false,
								isCourseGradesLayout: false,
								isCourseModules: false,
								isCourseBin: false,
								isCourseBackup: false,
								isCourseModule: false,
								isCourseModuleEdit: false,
								isCourseModuleSubmissions: false,
								isInCourseModuleLayout: false,
								isCourseSection: false,
								isCourseSectionNew: false,
								isCourseSectionEdit: false,
								isInCourseSectionLayout: false,
								isUserLayout: false,
								isUserOverview: false,
								isUserPreference: false,
								isUserModules: false,
								isUserGrades: false,
								isUserNotes: false,
								isUserNoteCreate: false,
								isUserNoteEdit: false,
								isInUserModulesLayout: false,
								isUserModuleNew: false,
								isUserModuleEdit: false,
								isUserModuleEditSetting: false,
								isUserModuleEditAccess: false,
								isUserProfile: false,
								isInUserModuleEditLayout: false,
								isAdminIndex: false,
								isAdminUsers: false,
								isAdminUserNew: false,
								isAdminCourses: false,
								isAdminSystem: false,
								isAdminTestEmail: false,
								isAdminCourseNew: false,
								isAdminCategories: false,
								isAdminCategoryNew: false,
								isAdminRegistration: false,
								isAdminMigrations: false,
								isAdminDependencies: false,
								params: {},
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

// Configure Commander.js program
const program = new Command();

program
	.name("paideia")
	.description(packageJson.description)
	.version(packageJson.version);

// Help command
program
	.command("help")
	.description("Show help information")
	.action(() => {
		console.log(asciiLogo);
		console.log(`Paideia LMS - ${packageJson.version}`);
		displayHelp();
		process.exit(0);
	});

// Server command
program
	.command("server")
	.description("Start the Paideia server")
	.action(async () => {
		await startServer();
	});

// Migration commands
const migrateCommand = program
	.command("migrate")
	.description("Database migration commands");

migrateCommand
	.command("status")
	.description("Show migration status")
	.action(async () => {
		console.log(asciiLogo);
		console.log("Checking migration status...");

		await getMigrationStatus({
			payload,
			migrations: migrations as MigrationType[],
		}).then((statuses) => {
			if (statuses) {
				printMigrationStatus(statuses);
			}
		});
		process.exit(0);
	});

migrateCommand
	.command("up")
	.description("Run pending migrations")
	.action(async () => {
		console.log(asciiLogo);
		console.log("Running migrations...");

		await payload.db.migrate({ migrations: migrations as MigrationType[] });
		console.log("✅ Migrations completed");
		process.exit(0);
	});

migrateCommand
	.command("fresh")
	.description("Drop all database entities and re-run migrations from scratch")
	.option("--force-accept-warning", "Force accept warning prompts")
	.action(async (options) => {
		console.log(asciiLogo);
		console.log("Fresh migration...");

		await migrateFresh({
			payload,
			migrations: migrations as MigrationType[],
			forceAcceptWarning: options.forceAcceptWarning || false,
		});
		await deleteEverythingInBucket();
		await new Promise((resolve) => setTimeout(resolve, 1000));
		console.log("✅ Fresh migration completed");
		process.exit(0);
	});

migrateCommand
	.command("dump")
	.description("Dump database to SQL file")
	.option("-o, --output <path>", "Output file path (relative to paideia_data directory)")
	.action(async (options) => {
		console.log(asciiLogo);
		console.log("Dumping database...");

		const result = await dumpDatabase({
			payload,
			outputPath: options.output,
		});

		if (!result.success) {
			console.error("❌ Failed to dump database:", result.error);
			process.exit(1);
		}

		console.log(`✅ Database dump completed: ${result.outputPath}`);
		process.exit(0);
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
