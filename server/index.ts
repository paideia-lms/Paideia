import { envVars, validateEnvVars } from "./env";
validateEnvVars();


import { Elysia } from "elysia";
import { reactRouter } from "./elysia-react-router";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./db-context";
import { getPayload } from "payload";
import sanitizedConfig from "./payload.config";


console.log("Mode: ", process.env.NODE_ENV)

const payload = await getPayload({
	config: sanitizedConfig,
})

// console.log("Payload: ", payload)


const port = Number(envVars.PORT.value) || envVars.PORT.default;

new Elysia()
	.use(async (e) =>
		await reactRouter(e, {
			getLoadContext: (context) => {
				const c = new RouterContextProvider();
				c.set(dbContextKey, { app: undefined as never });
				return c
			},
		}),
	)
	// .get("/some", "Hello")
	.listen(port, () => {
		console.log(
			`🚀 Paideia is running at http://localhost:${port}`,
		);
	});
