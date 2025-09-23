import type { AnyElysia, Context } from "elysia";
import { type AppLoadContext, createRequestHandler, ServerBuild } from "react-router";

import { staticPlugin } from "./static/static-plugin";
import type { ViteDevServer } from "vite";
import type { PluginOptions } from "./types";
// @ts-ignore
import * as _serverBuild from "../build/server/index.js";
import vfs from "./vfs";

/**
 * Initializes and configures an Elysia server with React Router integration.
 *
 * This function sets up the Elysia server to handle React Router SSR (Server-Side Rendering)
 * and optionally integrates Vite for development mode.
 *
 * @param {PluginOptions<AppLoadContext>} [options] - Optional configuration options for the plugin.
 * @returns {Promise<Elysia>} - A promise that resolves to the configured Elysia instance.
 *
 * @example
 * ```typescript
 * import { reactRouter } from "elysia-remix";
 *
 * new Elysia()
 *     .use(await reactRouter())
 *     .get("/some", "Hello, world!")
 *     .listen(3000, console.log);
 * ```
 */
export async function reactRouter(
    elysia: AnyElysia,
    options?: PluginOptions<AppLoadContext>,
): Promise<AnyElysia> {
    const cwd = process.env.REMIX_ROOT ?? process.cwd();
    const mode = options?.mode ?? process.env.NODE_ENV ?? "development";
    // const buildDirectory = join(cwd, options?.buildDirectory ?? "build");
    // const serverBuildPath = join(
    //     buildDirectory,
    //     "server",
    //     options?.serverBuildFile ?? "index.js",
    // );

    // console.log(buildDirectory);

    let vite: ViteDevServer | undefined;

    if (import.meta.env.DEV) {
        vite = await import("vite").then((vite) => {
            return vite.createServer({
                ...options?.vite,
                server: {
                    ...options?.vite?.server,
                    middlewareMode: true,
                },
            });
        });
    }

    if (vite && import.meta.env.DEV) {
        elysia.use(
            (await import("elysia-connect-middleware")).connect(vite.middlewares),
        );
    } else if (options?.production?.assets !== false) {
        elysia.use(
            staticPlugin({
                vfs,
                prefix: "/",
                maxAge: 31536000,
                ...options?.production?.assets,
            }),
        );
    }


    async function processReactRouterSSR(context: Context) {
        const serverBuild = vite
            ? await vite.ssrLoadModule("virtual:react-router/server-build")
            : _serverBuild as ServerBuild;
        const handler = createRequestHandler(
            // @ts-ignore
            serverBuild,
            mode,
        );

        const loadContext = await options?.getLoadContext?.(context);

        return handler(context.request, loadContext);
    }

    // ! 'all' does not works in binary
    elysia.get(
        "*",
        processReactRouterSSR,
        { parse: "none" },
    );
    elysia.delete("*", processReactRouterSSR, { parse: "none" });
    elysia.post("*", processReactRouterSSR, { parse: "none" });
    elysia.put("*", processReactRouterSSR, { parse: "none" });
    elysia.patch("*", processReactRouterSSR, { parse: "none" });
    elysia.head("*", processReactRouterSSR, { parse: "none" });
    elysia.options("*", processReactRouterSSR, { parse: "none" });
    elysia.connect("*", processReactRouterSSR, { parse: "none" });

    return elysia;
}