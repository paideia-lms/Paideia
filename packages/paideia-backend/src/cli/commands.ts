import { os } from "@orpc/server";
import type { Payload } from "payload";
import type { PackageJson } from "type-fest";
import { InfrastructureModule } from "modules/infrastructure";
import { UserModule } from "modules/user";
import { NoteModule } from "modules/note";
import { PagesModule } from "modules/pages";
import { CoursesModule } from "modules/courses";
import { sortModulesTopologically } from "shared/module-sorter";

export interface CliContext {
    payload: Payload;
    packageJson: PackageJson;
}

/**
 * 2. Create the CLI Router type by intersecting the CLI properties 
 * of all registered modules.
 */
type CombinedCli =
    typeof InfrastructureModule.cli &
    typeof UserModule.cli &
    typeof NoteModule.cli &
    typeof CoursesModule.cli &
    typeof PagesModule.cli;

const allModules = sortModulesTopologically([
    InfrastructureModule,
    UserModule,
    NoteModule,
    CoursesModule,
    PagesModule,
]);

const cliOs = os.$context<CliContext>();

const cliRouter = allModules.reduce((acc, mod) => ({ ...acc, ...mod.cli }), {}) as CombinedCli;

/**
 * Creates the oRPC CLI router for Paideia commands.
 * Context (payload) is passed when createCli is invoked.
 */
export function createCliRouter() {
    return cliOs.router(cliRouter);
}
