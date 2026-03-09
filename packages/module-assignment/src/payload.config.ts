import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import { UserModule } from "@paideia/module-user";
import { CourseModule } from "@paideia/module-course";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { Assignments } from "./collections/assignments";
import { AssignmentSubmissions } from "./collections/assignment-submissions";

const envVars = InfrastructureModule.envVars;

const __dirname = import.meta.dirname;

const pg = postgresAdapter({
	pool: {
		connectionString:
			envVars.DATABASE_URL.value ?? envVars.DATABASE_URL.default,
	},
	push: false,
});

const config = buildConfig({
	db: pg,
	secret: envVars.PAYLOAD_SECRET.value ?? envVars.PAYLOAD_SECRET.default!,
	serverURL: "http://localhost:3000",
	cors: ["http://localhost:3000", "http://localhost:3001"],
	csrf: ["http://localhost:3000", "localhost"],
	collections: [
		...UserModule.collections,
		...CourseModule.collections,
		Assignments,
		AssignmentSubmissions,
	],
	admin: {},
	defaultDepth: 1,
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
	plugins: [
		s3Storage({
			collections: {
				media: true,
			},
			bucket: envVars.S3_BUCKET.value ?? envVars.S3_BUCKET.default!,
			config: {
				credentials: {
					accessKeyId: envVars.S3_ACCESS_KEY.value ?? envVars.S3_ACCESS_KEY.default!,
					secretAccessKey: envVars.S3_SECRET_KEY.value ?? envVars.S3_SECRET_KEY.default!,
				},
				endpoint: envVars.S3_ENDPOINT_URL.value ?? envVars.S3_ENDPOINT_URL.default,
				region: envVars.S3_REGION.value ?? envVars.S3_REGION.default,
				forcePathStyle: true,
			},
		}),
	],
});

export default config;
