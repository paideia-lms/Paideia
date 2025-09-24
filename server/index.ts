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
import { envVars } from "./env";
import { showRoutes } from "bknd/plugins";


for (const [key, value] of Object.entries(envVars)) {
	if (value.required && !value.value) {
		throw new Error(`${key} is not set`);
	}
}

console.log(Object.entries(envVars).map(([key, value]) => `${key}: ${value.value}`))

// create the app
const config = {
	"connection": postgresJs(envVars.DATABASE_URL.value),
	options: {
		async seed(ctx) {

		},
		"plugins": [
			showRoutes({ once: true })
		]
	},
	"initialConfig": {
		auth: {
			'enabled': true,
			"allow_register": true,
			"strategies": {
				"password": {
					"enabled": true,
					"type": "password",
				},
			}
		},
		media: {
			enabled: true,
			adapter: {
				type: "s3",
				config: {
					// we will use R2 if R2 is provided
					access_key: envVars.R2_ACCESS_KEY.value ?? envVars.S3_ACCESS_KEY.value,
					secret_access_key: envVars.R2_SECRET_KEY.value ?? envVars.S3_SECRET_KEY.value,
					url: envVars.R2_URL.value ?? envVars.S3_URL.value,
				},
			},
		},
	}
} satisfies CreateAppConfig;
const app = createApp(config);

await app.build({
	"sync": true,
})

const mediaConfig = app.mutateConfig("media")

// @ts-ignore
mediaConfig.set({
	enabled: true,
	adapter: {
		type: "s3",
		config: {
			access_key: envVars.R2_ACCESS_KEY.value ?? envVars.S3_ACCESS_KEY.value,
			secret_access_key: envVars.R2_SECRET_KEY.value ?? envVars.S3_SECRET_KEY.value,
			url: envVars.R2_URL.value ?? envVars.S3_URL.value,
		},
	}
})




const port = Number(process.env.PORT) || 3000;

new Elysia()
	.use(async (e) =>
		await reactRouter(e, {
			getLoadContext: (context) => {
				const c = new RouterContextProvider();
				c.set(dbContextKey, { app: app });
				return c
			},
		}),
	)
	.get("/some", "Hello")
	.listen(port, () => {
		console.log(
			`Elysia React Router server is running at http://localhost:${port}`,
		);
	});
