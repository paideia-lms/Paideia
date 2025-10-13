import { envVars, validateEnvVars } from "./env";

validateEnvVars();

import { type Treaty, treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import { getPayload } from "payload";
import { RouterContextProvider } from "react-router";
import { createStorage } from "unstorage";
import lruCacheDriver from "unstorage/drivers/lru-cache";
import { globalContextKey } from "./contexts/global-context";
import { reactRouter } from "./elysia-react-router";
import { tryCheckFirstUser } from "./internal/check-first-user";
import { tryRegisterFirstUser } from "./internal/user-management";
import sanitizedConfig from "./payload.config";
import { devConstants } from "./utils/constants";
import { getRequestInfo } from "./utils/get-request-info";
import { s3Client } from "./utils/s3-client";
import { userContextKey } from "./contexts/user-context";
import { pageContextKey } from "./contexts/page-context";
import { courseContextKey } from "./contexts/course-context";
import { enrolmentContextKey } from "./contexts/enrolment-context";
import { courseModuleContextKey } from "./contexts/course-module-context";

const unstorage = createStorage({
	driver: lruCacheDriver({
		max: 1000,
		// how long to live in ms
		ttl: 1000 * 60 * 5,
	}),
});

console.log("Mode: ", process.env.NODE_ENV);

const payload = await getPayload({
	config: sanitizedConfig,
	cron: true,
	key: "paideia",
});

// console.log("Payload: ", payload)
if (process.env.NODE_ENV === "development") {
	// check the first user
	const users = await tryCheckFirstUser({ payload, overrideAccess: true });
	if (users.ok) {
		if (users.value) {
			const request = new Request("http://localhost:3000");
			// no user found
			// register the first user
			await tryRegisterFirstUser({
				payload,
				req: request,
				email: devConstants.ADMIN_EMAIL,
				password: devConstants.ADMIN_PASSWORD,
				firstName: "Admin",
				lastName: "User",
			});
		}
	}
}

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
					c.set(globalContextKey, {
						payload: payload,
						elysia: backend,
						api,
						requestInfo,
						s3Client,
						unstorage,
						envVars: envVars,
						// some fake data for now 
						routeHierarchy: [],
						pageInfo: {
							isAdmin: false,
							isMyCourses: false,
							isDashboard: false,
							isLogin: false,
							isFirstUser: false,
						},
					});
					// set all the contexts to be null in the beginning?? 
					c.set(userContextKey, null)
					c.set(pageContextKey, null)
					c.set(courseContextKey, null)
					c.set(enrolmentContextKey, null)
					c.set(courseModuleContextKey, null)
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
