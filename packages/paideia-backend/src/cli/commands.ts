import { os } from "@orpc/server";
import { Table } from "console-table-printer";
import type { Migration as MigrationType, Payload } from "payload";
import { z } from "zod";
import { migrations } from "../migrations";
import { asciiLogo } from "../utils/constants";
import { dumpDatabase } from "../utils/db/dump";
import { migrateFresh } from "../utils/db/migrate-fresh";
import {
	getMigrationStatus,
	printMigrationStatus,
} from "../utils/db/migration-status";
import { tryResetSandbox } from "../utils/db/sandbox-reset";
import { handleTransactionId } from "../internal/utils/handle-transaction-id";
import { deleteEverythingInBucket } from "../utils/s3-client";
import type { PackageJson } from "type-fest";

export interface CliContext {
	payload: Payload;
	packageJson: PackageJson;
}

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

const cliOs = os.$context<CliContext>();

const cliRouter = {
	help: cliOs
		.meta({ description: "Show help information" })
		.input(z.object({}).optional())
		.handler(async ({ context }) => {
			console.log(asciiLogo);
			context.payload.logger.info(
				`Paideia LMS - ${context.packageJson.version}`,
			);
			displayHelp();
		}),
	migrate: {
		status: cliOs
			.meta({ description: "Show migration status" })
			.input(z.object({}).optional())
			.handler(async ({ context }) => {
				console.log(asciiLogo);
				context.payload.logger.info("Checking migration status...");
				const statuses = await getMigrationStatus({
					payload: context.payload,
					migrations: migrations as MigrationType[],
				});
				if (statuses) {
					printMigrationStatus(statuses);
				}
			}),
		up: cliOs
			.meta({ description: "Run pending migrations" })
			.input(z.object({}).optional())
			.handler(async ({ context }) => {
				console.log(asciiLogo);
				context.payload.logger.info("Running migrations...");
				await context.payload.db.migrate({
					migrations: migrations as MigrationType[],
				});
				context.payload.logger.info("✅ Migrations completed");
			}),
		fresh: cliOs
			.meta({
				description:
					"Drop all database entities and re-run migrations from scratch",
			})
			.input(
				z
					.object({
						forceAcceptWarning: z
							.boolean()
							.optional()
							.describe("Force accept warning prompts"),
					})
					.optional(),
			)
			.handler(async ({ context, input }) => {
				console.log(asciiLogo);
				context.payload.logger.info("Fresh migration...");
				await migrateFresh({
					payload: context.payload,
					migrations: migrations as MigrationType[],
					forceAcceptWarning: input?.forceAcceptWarning ?? false,
				});
				await deleteEverythingInBucket({
					logger: context.payload.logger,
				});
				await new Promise((resolve) => setTimeout(resolve, 1000));
				context.payload.logger.info("✅ Fresh migration completed");
			}),
		dump: cliOs
			.meta({
				description: "Dump database to SQL file",
				aliases: { options: { output: "o" } },
			})
			.input(
				z
					.object({
						output: z
							.string()
							.optional()
							.describe(
								"Output file path (relative to paideia_data directory)",
							),
					})
					.optional(),
			)
			.handler(async ({ context, input }) => {
				console.log(asciiLogo);
				context.payload.logger.info("Dumping database...");
				const result = await dumpDatabase({
					payload: context.payload,
					outputPath: input?.output,
				});
				if (!result.success) {
					throw new Error(`Failed to dump database: ${result.error}`);
				}
				context.payload.logger.info(
					`✅ Database dump completed: ${result.outputPath}`,
				);
			}),
	},
	sandbox: {
		reset: cliOs
			.meta({
				description:
					"Reset sandbox database (only when SANDBOX_MODE is enabled)",
			})
			.input(z.object({}).optional())
			.handler(async ({ context }) => {
				console.log(asciiLogo);
				context.payload.logger.info("Resetting sandbox database...");
				const { tx } = await handleTransactionId(context.payload);
				const result = await tx(
					async (txInfo) => {
						return tryResetSandbox({
							payload: context.payload,
							req: txInfo.reqWithTransaction,
						});
					},
					(r) => !r.ok,
				);
				if (!result.ok) {
					throw new Error(
						`Failed to reset sandbox database: ${result.error.message}`,
					);
				}
				context.payload.logger.info(
					"✅ Sandbox database reset completed successfully",
				);
			}),
	},
};

/**
 * Creates the oRPC CLI router for Paideia commands.
 * Context (payload) is passed when createCli is invoked.
 */
export function createCliRouter() {
	return cliOs.router(cliRouter);
}
