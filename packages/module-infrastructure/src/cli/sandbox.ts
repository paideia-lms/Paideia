import { os } from "@orpc/server";
import { z } from "zod";
import { asciiLogo } from "../utils/constants";
import { handleTransactionId } from "@paideia/shared";
import { tryResetSandbox } from "../services/sandbox-reset";
import type { PackageJson } from "type-fest";
import type { Payload } from "payload";

const cliOs = os.$context<CliContext>();

export interface CliContext {
    payload: Payload;
    packageJson: PackageJson;
}

export const commands =
{
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
                context.payload.logger.info("✅ Sandbox database reset completed successfully");
            }),
    }
}
