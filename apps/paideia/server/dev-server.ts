import { createRequest, sendResponse } from "@remix-run/node-fetch-server";
import connect from "connect";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { createRequestHandler } from "react-router";
import type { RouterContextProvider } from "react-router";
import serveStatic from "serve-static";
import type { ViteDevServer } from "vite";
import { getServerBuild, setVite } from "./server-build-access";
import type { Payload } from "@paideia/paideia-backend";

export interface DevServerOptions {
	port: number;
	handleOpenApiRequest: (request: Request) => Promise<Response>;
	buildLoadContext: (
		request: Request,
		serverBuild: Awaited<ReturnType<typeof getServerBuild>>,
	) => RouterContextProvider | Promise<RouterContextProvider>;
	logger: Payload["logger"];
}

export async function createDevServer(options: DevServerOptions): Promise<{
	server: ReturnType<typeof createServer>;
	vite: ViteDevServer;
}> {
	const { port, handleOpenApiRequest, buildLoadContext, logger } = options;

	const vite = await import("vite").then((v) =>
		v.createServer({
			server: {
				middlewareMode: true,
			},
		}),
	);
	setVite(vite);
	logger.info("vite is running as middleware");

	const app = connect();

	// 1. OpenAPI - must run before Vite so /openapi/* is not served as SPA
	app.use(async (req: IncomingMessage, res: ServerResponse, next: connect.NextFunction) => {
		const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
		if (!pathname.startsWith("/openapi")) {
			next();
			return;
		}

		const request = await createRequest(req, res);
		const response = await handleOpenApiRequest(request);
		await sendResponse(res, response);
	});

	// 2. Vite middleware (HMR, asset serving)
	app.use(vite.middlewares);

	// 3. Static files from current directory (build/client, etc.)
	app.use(
		serveStatic(".", {
			maxAge: 31536000,
		}),
	);

	// 4. React Router catch-all
	app.use(async (req: IncomingMessage, res: ServerResponse) => {
		const request = await createRequest(req, res);
		const serverBuild = await getServerBuild();
		const handler = createRequestHandler(serverBuild, "development");
		const loadContext = await buildLoadContext(request, serverBuild);
		const response = await handler(request, loadContext);
		await sendResponse(res, response);
	});

	const server = createServer(app);
	server.listen(port, () => {
		logger.info(`🚀 Paideia frontend is running at http://localhost:${port}`);
	});

	return { server, vite };
}
