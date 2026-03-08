import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import type { TaskConfig } from "payload";
import { buildConfig } from "payload";
import { envVars } from "./services/env";
import { sandboxReset } from "./tasks/sandbox-reset";

const __dirname = import.meta.dirname;

const pg = postgresAdapter({
	pool: {
		connectionString:
			envVars.DATABASE_URL.value ?? envVars.DATABASE_URL.default,
	},
	push: process.env.NODE_ENV === "test",
});


const autoSubmitQuiz = {
	slug: "autoSubmitQuiz" as const,
	handler: async () => {
		return {
			state: "succeeded",
		}
	}
};

const config = buildConfig({
	db: pg,
	secret: envVars.PAYLOAD_SECRET.value ?? envVars.PAYLOAD_SECRET.default!,
	serverURL: "http://localhost:3000",
	cors: ["http://localhost:3000", "http://localhost:3001"],
	csrf: ["http://localhost:3000", "localhost"],
	collections: [],
	admin: {},
	defaultDepth: 1,
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
	jobs: {
		deleteJobOnComplete: false,
		autoRun: [
			{ cron: "0 0 * * *", queue: "nightly" },
			{ cron: "* * * * * *", queue: "secondly" },
			{ cron: "* * * * *", queue: "minute" },
			{ cron: "0 * * * *", queue: "hourly" },
		],
		tasks: [sandboxReset, autoSubmitQuiz] as TaskConfig[],
	},
});

export default config;
