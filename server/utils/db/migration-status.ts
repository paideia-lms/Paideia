import { Table } from "console-table-printer";
import { getMigrations } from "payload";
import type { Payload } from "payload";
import type { Migration } from "payload";

/**
 * Check if the migration table exists in the database
 * Uses the same approach as Payload's migrationTableExists utility
 * 
 * see node_modules/@payloadcms/drizzle/dist/utilities/migrationTableExists.js 
 * 
 */
async function migrationTableExists(payload: Payload): Promise<boolean> {
    const adapter = payload.db;
    let statement: string | undefined;

    if (adapter.name === "postgres") {
        const prependSchema = adapter.schemaName ? `"${adapter.schemaName}".` : "";
        statement = `SELECT to_regclass('${prependSchema}payload_migrations') AS exists;`;
    }

    if (adapter.name === "sqlite") {
        statement = `
      SELECT CASE
               WHEN COUNT(*) > 0 THEN 1
               ELSE 0
               END AS 'exists'
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'payload_migrations';`;
    }

    if (!statement) {
        return false;
    }

    try {
        const result = await adapter.execute({
            drizzle: adapter.drizzle,
            raw: statement,
        });

        const [row] = result.rows;
        return (
            row &&
            typeof row === "object" &&
            "exists" in row &&
            !!(row as { exists: unknown }).exists
        );
    } catch {
        return false;
    }
}

/**
 * Get migration status by comparing provided migrations with existing migrations in database
 * This works with compiled binaries where migration files are not on disk
 * 
 * see node_modules/@payloadcms/drizzle/dist/migrateStatus.js 
 */
export async function getMigrationStatus({
    payload,
    migrations,
}: {
    payload: Payload;
    migrations: Migration[];
}): Promise<void> {
    if (!migrations.length) {
        payload.logger.info({
            msg: "No migrations found.",
        });
        return;
    }

    let existingMigrations: Array<{ name?: string; batch?: number }> = [];
    const hasMigrationTable = await migrationTableExists(payload);

    if (hasMigrationTable) {
        try {
            const result = await getMigrations({
                payload,
            });
            existingMigrations = result.existingMigrations || [];
        } catch (error) {
            payload.logger.error({
                msg: "Failed to fetch existing migrations",
                err: error,
            });
        }
    }

    // Compare provided migrations to existing migrations
    const statuses = migrations.map((migration) => {
        const existingMigration = existingMigrations.find(
            (m) => m.name === migration.name,
        );
        return {
            Name: migration.name,
            Batch: existingMigration?.batch ?? null,
            Ran: existingMigration ? "Yes" : "No",
        };
    });

    const table = new Table();
    statuses.forEach((s) => {
        table.addRow(s, {
            color: s.Ran === "Yes" ? "green" : "red",
        });
    });

    table.printTable();
}

