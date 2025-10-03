import { envVars, validateEnvVars } from "./env";

validateEnvVars();

import { type Treaty, treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import { getPayload } from "payload";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./contexts/global-context";
import { reactRouter } from "./elysia-react-router";
import sanitizedConfig from "./payload.config";
import { getRequestInfo } from "./utils/get-request-info";

console.log("Mode: ", process.env.NODE_ENV);

const payload = await getPayload({
	config: sanitizedConfig,
	cron: true,
	key: "paideia",
});

// console.log("Payload: ", payload)

const port = Number(envVars.PORT.value) || envVars.PORT.default;
const frontendPort =
	Number(envVars.FRONTEND_PORT.value) || envVars.FRONTEND_PORT.default;

const backend = new Elysia()
	.state("payload", payload)
	.use(openapi())
	.listen(port, () => {
		console.log(`🚀 Paideia backend is running at http://localhost:${port}`);
	});

const frontend = new Elysia()
	.use(
		async (e) =>
			await reactRouter(e, {
				getLoadContext: ({ request }) => {
					const c = new RouterContextProvider();
					const requestInfo = getRequestInfo(request);
					c.set(dbContextKey, {
						payload: payload,
						elysia: backend,
						api,
						requestInfo,
					});
					return c;
				},
			}),
	)
	.listen(frontendPort, () => {
		console.log(
			`🚀 Paideia frontend is running at http://localhost:${frontendPort}`,
		);
	});

const api = treaty(backend);

export type Backend = typeof backend;
export type Api = Treaty.Create<Backend>;
export type Frontend = typeof frontend;
