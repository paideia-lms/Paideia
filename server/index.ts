import { envVars, validateEnvVars } from "./env";
validateEnvVars();


import { Elysia, t } from "elysia";
import { Treaty, treaty } from '@elysiajs/eden'

import { reactRouter } from "./elysia-react-router";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./global-context";
import { getPayload } from "payload";
import sanitizedConfig from "./payload.config";
import { checkFirstUser, getUserCount, validateFirstUserState } from "./check-first-user";
import { z } from "zod";
import { openapi } from "@elysiajs/openapi";


console.log("Mode: ", process.env.NODE_ENV)

const payload = await getPayload({
	config: sanitizedConfig,
})

// console.log("Payload: ", payload)


const port = Number(envVars.PORT.value) || envVars.PORT.default;
const frontendPort = Number(envVars.FRONTEND_PORT.value) || envVars.FRONTEND_PORT.default;

const backend = new Elysia()
	.use(openapi())
	.get("/some", "Hello, world!")
	.get("/api/check-first-user", async () => {
		try {
			const needsFirstUser = await checkFirstUser();
			return {
				success: true,
				needsFirstUser,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}, {
		body: z.object({})
	})
	.get("/api/user-count", async ({ body }) => {
		try {
			const count = await getUserCount();
			return {
				success: true,
				count,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},)
	.get("/api/validate-first-user-state", async () => {
		try {
			const state = await validateFirstUserState();
			return {
				success: true,
				...state,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	})

	.listen(port, () => {
		console.log(
			`🚀 Paideia backend is running at http://localhost:${port}`,
		);
	});


const frontend = new Elysia().use(async (e) => await reactRouter(e, {
	getLoadContext: (context) => {
		const c = new RouterContextProvider();
		c.set(dbContextKey, { payload: payload, elysia: backend, api: treaty(backend) });
		return c
	},
}),
).listen(frontendPort, () => {
	console.log(
		`🚀 Paideia frontend is running at http://localhost:${frontendPort}`,
	);
});


export type Backend = typeof backend;
export type Api = Treaty.Create<Backend>
export type Frontend = typeof frontend;