import { Elysia } from "elysia";
import { reactRouter } from "./elysia-react-router";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./db-context";
import { envVars } from "./env";


for (const [key, value] of Object.entries(envVars)) {
	if (value.required && !value.value) {
		throw new Error(`${key} is not set`);
	}
}

const port = Number(process.env.PORT) || 3000;

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
