import { os } from "@orpc/server";
import type { Payload } from "payload";
import type { PackageJson } from "type-fest";
import { InfrastructureModule } from "modules/infrastructure";
import { UserModule } from "modules/user";
import { NoteModule } from "modules/note";

export interface CliContext {
	payload: Payload;
	packageJson: PackageJson;
}



const cliOs = os.$context<CliContext>();

const cliRouter = {
	...InfrastructureModule.cli,
	...UserModule.cli,
	...NoteModule.cli,
};

/**
 * Creates the oRPC CLI router for Paideia commands.
 * Context (payload) is passed when createCli is invoked.
 */
export function createCliRouter() {
	return cliOs.router(cliRouter);
}
