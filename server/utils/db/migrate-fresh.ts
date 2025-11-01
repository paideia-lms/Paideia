import {
    commitTransaction,
    createLocalReq,
    initTransaction,
    killTransaction,
} from "payload";
import prompts from "prompts";
import type { Payload, PayloadRequest } from "payload";
import type { Migration } from "payload";

/**
 * Returns current db transaction instance from req or adapter.drizzle itself
 * see node_modules/@payloadcms/drizzle/dist/utilities/getTransaction.js
 */
async function getTransaction(adapter: Payload["db"], req: PayloadRequest) {
    if (!req?.transactionID) {
        return adapter.drizzle;
    }
    const transactionIDValue = await Promise.resolve(req.transactionID);
    if (!transactionIDValue) {
        return adapter.drizzle;
    }
    // sessions exists on adapter but may not be in type definitions
    const sessions = (adapter as { sessions?: Record<string | number, { db: typeof adapter.drizzle }> }).sessions;
    if (!sessions) {
        return adapter.drizzle;
    }
    return sessions[transactionIDValue]?.db || adapter.drizzle;
}

/**
 * Format error message with hint if available
 * see node_modules/@payloadcms/drizzle/dist/utilities/parseError.js
 */
function parseError(err: unknown, msg: string): string {
    let formattedMsg = `${msg}`;
    if (err instanceof Error) {
        formattedMsg += ` ${err.message}.`;
        // Check if the error has a hint property
        if ("hint" in err && typeof err.hint === "string") {
            formattedMsg += ` ${err.hint}.`;
        }
    }
    return formattedMsg;
}

/**
 * Drop the current database and run all migrate up functions
 * This works with compiled binaries where migration files are not on disk
 *
 * see node_modules/@payloadcms/drizzle/dist/migrateFresh.js
 */
export async function migrateFresh({
    payload,
    migrations,
    forceAcceptWarning = false,
}: {
    payload: Payload;
    migrations: Migration[];
    forceAcceptWarning?: boolean;
}): Promise<void> {
    if (forceAcceptWarning === false) {
        const { confirm: acceptWarning } = await prompts(
            {
                name: "confirm",
                type: "confirm",
                initial: false,
                message: `WARNING: This will drop your database and run all migrations. Are you sure you want to proceed?`,
            },
            {
                onCancel: () => {
                    process.exit(0);
                },
            },
        );
        if (!acceptWarning) {
            process.exit(0);
        }
    }

    payload.logger.info({
        msg: `Dropping database.`,
    });

    // Call dropDatabase on the adapter (matches original: this.dropDatabase({ adapter: this }))
    // dropDatabase is not in the type definitions but exists on the adapter
    const adapterWithDropDatabase = payload.db as Payload["db"] & {
        dropDatabase: (args: { adapter: Payload["db"] }) => Promise<void>;
    };
    await adapterWithDropDatabase.dropDatabase({
        adapter: payload.db,
    });

    payload.logger.debug({
        msg: `Found ${migrations.length} migration files.`,
    });

    const req = await createLocalReq({}, payload);

    if (
        "createExtensions" in payload.db &&
        typeof payload.db.createExtensions === "function"
    ) {
        await payload.db.createExtensions();
    }

    // Run all migrate up
    for (const migration of migrations) {
        payload.logger.info({
            msg: `Migrating: ${migration.name}`,
        });
        try {
            const start = Date.now();
            await initTransaction(req);
            const db = await getTransaction(payload.db, req);
            await migration.up({
                db,
                payload,
                req,
            });
            await payload.create({
                collection: "payload-migrations",
                data: {
                    name: migration.name,
                    batch: 1,
                },
                req,
            });
            await commitTransaction(req);
            payload.logger.info({
                msg: `Migrated:  ${migration.name} (${Date.now() - start}ms)`,
            });
        } catch (err) {
            await killTransaction(req);
            payload.logger.error({
                err,
                msg: parseError(err, `Error running migration ${migration.name}. Rolling back`),
            });
            process.exit(1);
        }
    }
}

