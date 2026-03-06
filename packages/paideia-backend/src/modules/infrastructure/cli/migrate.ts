import { os } from "@orpc/server";
import { z } from "zod";
import { asciiLogo } from "../../../utils/constants";
import { getMigrationStatus, printMigrationStatus } from "../services/migration-status";
import { migrateFresh } from "../services/migrate-fresh";
import { dumpDatabase } from "../services/dump";
import { migrations } from "../../../migrations";
import type { Migration as MigrationType } from "payload";
import type { PackageJson } from "type-fest";
import type { Payload } from "payload";
import { deleteEverythingInBucket } from "../services/s3-client";

const cliOs = os.$context<CliContext>();

export interface CliContext {
    payload: Payload;
    packageJson: PackageJson;
}

export const commands = {
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
                await deleteEverythingInBucket({ logger: context.payload.logger });
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
                context.payload.logger.info(`✅ Database dump completed: ${result.outputPath}`);
            }),
    }
};
