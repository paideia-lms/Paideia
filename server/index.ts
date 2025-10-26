import { envVars, validateEnvVars } from "./env";

validateEnvVars();

import { type Treaty, treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { getPayload } from "payload";
import { RouterContextProvider } from "react-router";
import { createStorage } from "unstorage";
import lruCacheDriver from "unstorage/drivers/lru-cache";
import { courseContextKey } from "./contexts/course-context";
import { courseModuleContextKey } from "./contexts/course-module-context";
import { enrolmentContextKey } from "./contexts/enrolment-context";
import { globalContextKey } from "./contexts/global-context";
import { userAccessContextKey } from "./contexts/user-access-context";
import { userContextKey } from "./contexts/user-context";
import { userModuleContextKey } from "./contexts/user-module-context";
import { userProfileContextKey } from "./contexts/user-profile-context";
import { reactRouter } from "./elysia-react-router";
import sanitizedConfig from "./payload.config";
import { runSeed } from "./seed";
import { getRequestInfo } from "./utils/get-request-info";
import { s3Client } from "./utils/s3-client";

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
	await runSeed({ payload });
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
							isCreatingFirstUser: false,
							isInCourse: false,
							isCourseSettings: false,
							isCourseParticipants: false,
							isCourseParticipantsLayout: false,
							isCourseGroups: false,
							isCourseGrades: false,
							isCourseModules: false,
							isCourseBin: false,
							isCourseBackup: false,
							isCourseModule: false,
							isCourseSection: false,
							isCourseSectionNew: false,
							isUserLayout: false,
							isUserOverview: false,
							isUserPreference: false,
							isUserModules: false,
							isUserGrades: false,
							isUserNotes: false,
							isUserNoteCreate: false,
							isUserNoteEdit: false,
							isInUserModulesLayout: false,
							isUserModuleNew: false,
							isUserModuleEdit: false,
							isUserModuleEditSetting: false,
							isUserModuleEditAccess: false,
							isUserProfile: false,
							isInUserModuleEditLayout: false,
						},
					});
					// set all the contexts to be null in the beginning??
					c.set(userContextKey, null);
					c.set(courseContextKey, null);
					c.set(enrolmentContextKey, null);
					c.set(courseModuleContextKey, null);
					c.set(userAccessContextKey, null);
					c.set(userProfileContextKey, null);
					c.set(userModuleContextKey, null);
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
