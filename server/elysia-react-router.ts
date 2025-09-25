import type { AnyElysia, Context } from "elysia";
import { type AppLoadContext, createRequestHandler, ServerBuild, RouterContextProvider } from "react-router";
import { staticPlugin as _staticPlugin } from "@elysiajs/static";

import { staticPlugin } from "./static/static-plugin";
import type { ViteDevServer } from "vite";
import type { PluginOptions } from "./types";
// @ts-ignore
// import * as _serverBuild from "../build/server/index.js";
import vfs from "./vfs";
import { dbContext, dbContextKey } from "./db-context";

function isContext(c: any): c is Context {
    return "request" in c && "route" in c && "server" in c
}

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
    options?: PluginOptions<RouterContextProvider>,
): Promise<AnyElysia> {
    // const cwd = process.env.REMIX_ROOT ?? process.cwd();
    // const buildDirectory = join(cwd, options?.buildDirectory ?? "build");
    // const serverBuildPath = join(
    //     buildDirectory,
    //     "server",
    //     options?.serverBuildFile ?? "index.js",
    // );

    // console.log(buildDirectory);

    let vite: ViteDevServer | undefined;




    if (process.env.ENV !== "production") {
        vite = await import("vite").then((vite) => {
            return vite.createServer({
                ...options?.vite,
                server: {
                    ...options?.vite?.server,
                    middlewareMode: true,
                },
            });
        })
        console.log(`vite is running as middleware`)
    }

    if (process.env.ENV !== "production" && vite) {
        elysia.use(
            (await import("elysia-connect-middleware")).connect(vite.middlewares),
        );
        console.log(`attaching vite as middleware`)

        elysia.use(_staticPlugin(
            {
                prefix: "/",
                assets: ".",
                maxAge: 31536000,
                // ! in development, we want to disable cache
                noCache: true,
                ...options?.production?.assets,
            }
        ))
        console.log(`attaching static as middleware`)
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


    async function processReactRouterSSR(context: any) {
        // if c is not context, throw an error
        if (!isContext(context)) {
            throw new Error("Context is required");
        }

        const serverBuild = vite ?
            await vite.ssrLoadModule("virtual:react-router/server-build")
            // @ts-ignore
            // ! this will appear when we run build
            : await import("../build/server/index.js") as ServerBuild;
        const handler = createRequestHandler(
            // @ts-ignore
            serverBuild,
            process.env.ENV !== "production" ? "development" : "production",
        );

        const loadContext = await options?.getLoadContext?.(context);

        if (!loadContext) {
            throw new Error("Load context is required");
        }

        // context.request.loadContext = loadContext
        return handler(context.request, loadContext);
    }

    // ! 'all' does not works in binary
    elysia.get(
        "*",
        (c) => processReactRouterSSR(c),
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

function join(arg0: string, arg1: string): string | undefined {
    throw new Error("Function not implemented.");
}
