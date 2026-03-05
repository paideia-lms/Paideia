import { SandboxResetError, transformError } from "../../../errors";
import { Result } from "typescript-result";
import { envVars } from "./env";
import { tryLoadSeedData } from "../../../utils/db/load-seed-data";
import { tryRunSeed } from "../../../utils/db/seed";
import type { Vfs } from "../../../utils/db/seed-utils/vfs-utils";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { handleTransactionId } from "shared/handle-transaction-id";
import { migrateFresh } from "./migrate-fresh";
import { migrations } from "server/migrations";
import { Migration } from "payload";

interface TryResetSandboxArgs extends BaseInternalFunctionArgs {
	vfs?: Vfs;
}


/**
 * Resets the sandbox database by deleting all user data and seeding with fresh data
 * Only runs if sandbox mode is enabled
 * Preserves system tables: payload-jobs, payload-jobs-log, payload-migrations, etc.
 *
 * if fail, it will rollback the transaction.
 */
export function tryResetSandbox(args: TryResetSandboxArgs) {
	const { payload, req } = args;
	return Result.try(
		async () => {
			// Check if sandbox mode is enabled
			if (!envVars.SANDBOX_MODE.enabled) {
				throw new SandboxResetError("Sandbox mode is not enabled", {
					cause: new Error("Sandbox mode is not enabled"),
				});
			}

			console.log("🔄 Sandbox mode enabled, resetting database...");

			const transactionInfo = await handleTransactionId(payload, req);
			await transactionInfo.tx(async (txInfo) => {
					await migrateFresh({
						payload,
						migrations: migrations as Migration[], 
						forceAcceptWarning: true,
					})

				await Bun.sleep(1000);

				// Load seed data (falls back to testData if seed.json invalid/missing)
				const seedData = tryLoadSeedData({ logger: payload.logger }).getOrThrow();

				// Run seed with loaded data
				const seedResult = await tryRunSeed({
					payload: args.payload,
					req: txInfo.reqWithTransaction,
					seedData: seedData,
					vfs: args.vfs ?? {},
				}).getOrThrow();

				console.log("✅ Sandbox database reset completed successfully");

				return seedResult;
			});
		},
		(error) => {
			return (
				transformError(error) ??
				new SandboxResetError(
					`Sandbox reset failed: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				)
			);
		},
	);
}
