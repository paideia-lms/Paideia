import { Command } from "commander";
import { Table } from "console-table-printer";
import type { Migration as MigrationType, Payload } from "payload";
import { migrations } from "src/migrations";
import packageJson from "../../package.json";
import { deleteEverythingInBucket } from "../../scripts/clean-s3";
import { asciiLogo } from "../utils/constants";
import { dumpDatabase } from "../utils/db/dump";
import { migrateFresh } from "../utils/db/migrate-fresh";
import {
	getMigrationStatus,
	printMigrationStatus,
} from "../utils/db/migration-status";
import { tryResetSandbox } from "../utils/db/sandbox-reset";

/**
 * Displays help information with all available CLI commands
 */
export function displayHelp() {
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
	table.addRow({
		Command: "paideia sandbox reset",
		Description: "Reset sandbox database (only when SANDBOX_MODE is enabled)",
	});
	table.printTable();
}

/**
 * Configures and returns the Commander.js program with all CLI commands
 */
export function configureCommands(payload: Payload): Command {
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

			await payload.db.migrate({
				migrations: migrations as MigrationType[],
			});
			console.log("✅ Migrations completed");
			process.exit(0);
		});

	migrateCommand
		.command("fresh")
		.description(
			"Drop all database entities and re-run migrations from scratch",
		)
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
		.option(
			"-o, --output <path>",
			"Output file path (relative to paideia_data directory)",
		)
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

	// Sandbox commands
	const sandboxCommand = program
		.command("sandbox")
		.description("Sandbox mode commands");

	sandboxCommand
		.command("reset")
		.description("Reset sandbox database (only when SANDBOX_MODE is enabled)")
		.action(async () => {
			console.log(asciiLogo);
			console.log("Resetting sandbox database...");

			const resetResult = await tryResetSandbox(payload);

			if (!resetResult.ok) {
				console.error(
					`❌ Failed to reset sandbox database: ${resetResult.error.message}`,
				);
				process.exit(1);
			}

			console.log("✅ Sandbox database reset completed successfully");
			process.exit(0);
		});

	return program;
}
