import { Elysia } from "elysia";
import { reactRouter } from "./elysia-react-router";
import { RouterContextProvider } from "react-router";
import { dbContextKey } from "./db-context";
import { createApp, type CreateAppConfig, } from "bknd";
// import {
// 	type ReactRouterBkndConfig,
// 	getApp as getBkndApp,
//   } from "bknd/adapter/react-router";
import { postgresJs } from "@bknd/postgres";


if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}


// create the app
const config = {
	"connection": postgresJs(process.env.DATABASE_URL),
	options: {
		async seed(ctx) {

		},
	}
} satisfies CreateAppConfig;
const app = createApp(config);

await app.build()



const port = Number(process.env.PORT) || 3000;

new Elysia()
	.use(async (e) =>
		await reactRouter(e, {
			getLoadContext: (context) => {
				const c = new RouterContextProvider();
				c.set(dbContextKey, { app: app });
				return c
			}
		}),
	)
	.get("/some", "Hello")
	.listen(port, () => {
		console.log(
			`Elysia React Router server is running at http://localhost:${port}`,
		);
	});
