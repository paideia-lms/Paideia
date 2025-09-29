import { staticPlugin as _staticPlugin } from "@elysiajs/static";
import { type AnyElysia, type Context, Elysia } from "elysia";
import {
	type AppLoadContext,
	createRequestHandler,
	type RouterContextProvider,
	type ServerBuild,
} from "react-router";
import type { ViteDevServer } from "vite";
import { staticPlugin } from "./static/static-plugin";
import type { PluginOptions } from "./types";
import vfs from "./vfs";

function isContext(c: any): c is Context {
	return "request" in c && "route" in c && "server" in c;
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
	// ! we are not using this but some elysia eneds this props to work???
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

	// ! we have to use this rather than passing in the elysia instance
	// const elysia = new Elysia({
	//     name: "elysia-react-router",
	//     seed: options
	// })

	if (process.env.ENV !== "production") {
		vite = await import("vite").then((vite) => {
			return vite.createServer({
				...options?.vite,
				server: {
					...options?.vite?.server,
					middlewareMode: true,
				},
			});
		});
		console.log(`vite is running as middleware`);
	}

	if (process.env.ENV !== "production" && vite) {
		elysia.use(
			(await import("elysia-connect-middleware")).connect(vite.middlewares),
		);
		console.log(`attaching vite as middleware`);

		elysia.use(
			_staticPlugin({
				prefix: "/",
				assets: ".",
				maxAge: 31536000,
				// ! in development, we want to disable cache
				noCache: true,
				...options?.production?.assets,
			}),
		);
		console.log(`attaching static as middleware`);
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

		const serverBuild = vite
			? await vite.ssrLoadModule("virtual:react-router/server-build")
			: // @ts-expect-error
				// ! this will appear when we run build
				((await import("../build/server/index.js")) as ServerBuild);
		const handler = createRequestHandler(
			// @ts-expect-error
			serverBuild,
			process.env.ENV !== "production" ? "development" : "production",
		);

		const loadContext = await options?.getLoadContext?.(context);

		if (!loadContext) {
			throw new Error("Load context is required");
		}
		return handler(context.request, loadContext);
	}

	// ! 'all' does not works in binary
	elysia.get("*", (c) => processReactRouterSSR(c), { parse: "none" });
	elysia.delete("*", processReactRouterSSR, { parse: "none" });
	elysia.post("*", processReactRouterSSR, { parse: "none" });
	elysia.put("*", processReactRouterSSR, { parse: "none" });
	elysia.patch("*", processReactRouterSSR, { parse: "none" });
	elysia.head("*", processReactRouterSSR, { parse: "none" });
	elysia.options("*", processReactRouterSSR, { parse: "none" });
	elysia.connect("*", processReactRouterSSR, { parse: "none" });

	return elysia;
}
