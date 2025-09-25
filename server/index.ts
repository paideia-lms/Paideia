import { envVars, validateEnvVars } from "./env";
validateEnvVars();


import { Elysia } from "elysia";
import { reactRouter } from "./elysia-react-router";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./db-context";
import { getPayload } from "payload";
import sanitizedConfig from "./payload.config";
import { checkFirstUser, getUserCount, validateFirstUserState } from "./check-first-user";


console.log("Mode: ", process.env.NODE_ENV)

const payload = await getPayload({
	config: sanitizedConfig,
})

// console.log("Payload: ", payload)


const port = Number(envVars.PORT.value) || envVars.PORT.default;

const app = new Elysia()
	.use(async (e) =>
		await reactRouter(e, {
			getLoadContext: (context) => {
				const c = new RouterContextProvider();
				c.set(dbContextKey, { payload: payload, elysia: app });
				return c
			},
		}),
	)
	// API endpoints for first user checks
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
	})
	.get("/api/user-count", async () => {
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
	})
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
			`🚀 Paideia is running at http://localhost:${port}`,
		);
	});


export type App = typeof app;