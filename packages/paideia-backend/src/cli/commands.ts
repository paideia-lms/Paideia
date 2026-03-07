import { os } from "@orpc/server";
import type { Payload } from "payload";
import type { PackageJson, UnionToIntersection, } from "type-fest";
import { allModules } from "../modules.gen";

export interface CliContext {
    payload: Payload;
    packageJson: PackageJson;
}

/**
 * 2. Create the CLI Router type by intersecting the CLI properties 
 * of all registered modules.
 */
type CombinedCli =
    UnionToIntersection<typeof allModules[number]["cli"]>;


const cliOs = os.$context<CliContext>();

const cliRouter = allModules.reduce((acc, mod) => ({ ...acc, ...mod.cli }), {}) as CombinedCli;

/**
 * Creates the oRPC CLI router for Paideia commands.
 * Context (payload) is passed when createCli is invoked.
 */
export function createCliRouter() {
    return cliOs.router(cliRouter);
}
