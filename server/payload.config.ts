import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { searchPlugin } from "@payloadcms/plugin-search";
import { s3Storage } from "@payloadcms/storage-s3";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import { buildConfig, type CollectionConfig, type GlobalConfig } from "payload";
import sharp from "sharp";
import { migrations } from "src/migrations";
import {
	ActivityModuleGrants,
	ActivityModules,
	AssignmentSubmissions,
	Assignments,
	CategoryRoleAssignments,
	CourseActivityModuleLinks,
	CourseCategories,
	CourseGradeTables,
	Courses,
	DiscussionSubmissions,
	Discussions,
	Enrollments,
	GradebookCategories,
	GradebookItems,
	Gradebooks,
	Groups,
	Media,
	Notes,
	QuizSubmissions,
	Quizzes,
	SystemGradeTable,
	UserGrades,
	Users,
} from "./collections";
import { envVars } from "./env";
import { devConstants } from "./utils/constants";

export * from "./collections";

const pg = postgresAdapter({
	pool: {
		connectionString: envVars.DATABASE_URL.value,
	},
	prodMigrations: migrations,
	// disable logger in different environments
	logger:
		process.env.NODE_ENV !== "test" &&
		process.env.NODE_ENV !== "production" &&
		process.env.NODE_ENV !== "development"
			? new EnhancedQueryLogger()
			: undefined,
	// ! we never want to push directly, always respect the the migrations files
	push: false,
	// process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production" ,
	afterSchemaInit: [
		// change the foreign key constraint to delete cascade
		({ schema }) => {
			// console.log(Object.keys(schema.relations));
			// Modify foreign key constraints for activity_module_grants
			const relations = [
				{
					relation: "relations_activity_module_grants",
					foreignTable: "activity_modules",
				},
			];

			relations.forEach((relation) => {
				const index = Symbol.for("drizzle:PgInlineForeignKeys");
				// @ts-expect-error workaround
				const fkeys = schema.relations[relation.relation]?.table[index];
				if (fkeys) {
					// console.log(fkeys, relation);
					// Loop through the foreign keys and modify them
					// @ts-expect-error workaround
					fkeys.forEach((foreignKey) => {
						// console.log(foreignKey.reference().foreignTable[Symbol.for("drizzle:Name")]);
						// Change activityModule foreign key to CASCADE on delete
						if (
							foreignKey.reference().foreignTable[
								Symbol.for("drizzle:Name")
							] === relation.foreignTable
						) {
							// console.log(foreignKey)
							foreignKey.onDelete = "CASCADE";
							foreignKey.onUpdate = "CASCADE";
						}
					});
				}
			});
			return schema;
		},
	],
});

const __dirname = import.meta.dirname;

// export const MigrateDatabase: TaskConfig<'MigrateDatabase'> = {
// 	slug: 'MigrateDatabase' as const,
// 	schedule: [
// 		{
// 			cron: `* * * * * *`, // every second
// 			queue: 'minute',
// 			hooks: {
// 				beforeSchedule: async ({ req }) => {
// 					return {
// 						shouldSchedule: (envVars.SANDBOX_MODE.value ?? envVars.SANDBOX_MODE.default) !== "0"
// 					}
// 				}
// 			}
// 		},
// 	],

// 	outputSchema: [{
// 		name: "message",
// 		type: "text",
// 		required: true,
// 	}],
// 	handler: async ({ tasks, req, input }) => {
// 		try {
// 			console.log("Migrating database...");
// 			await req.payload.db.migrateFresh({
// 				forceAcceptWarning: true
// 			})
// 			return {
// 				state: "succeeded",
// 				output: {
// 					message: "Migration succeeded"
// 				},
// 			}
// 		} catch (error) {
// 			return {
// 				state: "failed",
// 				errorMessage: error instanceof Error ? error.message : "Unknown error",
// 			}
// 		}
// 	},
// }

const sanitizedConfig = await buildConfig({
	db: pg,
	secret: envVars.PAYLOAD_SECRET.value,
	// ? shall we use localhost or the domain of the server
	serverURL: `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
	sharp,
	collections: [
		Users,
		Courses,
		CourseCategories,
		CategoryRoleAssignments,
		Enrollments,
		ActivityModules,
		ActivityModuleGrants,
		Assignments,
		Quizzes,
		Discussions,
		CourseActivityModuleLinks,
		Media,
		Notes,
		Gradebooks,
		GradebookCategories,
		GradebookItems,
		AssignmentSubmissions,
		QuizSubmissions,
		DiscussionSubmissions,
		CourseGradeTables,
		Groups,
		UserGrades,
	] as CollectionConfig[],
	globals: [SystemGradeTable] as GlobalConfig[],
	csrf: [
		// ! this is required for the local development to work
		...(process.env.NODE_ENV === "development"
			? ["http://localhost:3000", "localhost"]
			: []),
	].filter(Boolean) as string[],
	admin: {
		// ! when you use auto login, you can never logout
		// autoLogin: process.env.NODE_ENV === "development" ? {
		// 	email: devConstants.ADMIN_EMAIL,
		// 	password: devConstants.ADMIN_PASSWORD,
		// } : undefined,
	},
	email:
		envVars.SMTP_HOST.value &&
		envVars.SMTP_USER.value &&
		envVars.SMTP_PASS.value
			? nodemailerAdapter({
					defaultFromAddress: "info@payloadcms.com",
					defaultFromName: "Payload",
					// Nodemailer transportOptions
					transportOptions: {
						host: envVars.SMTP_HOST.value,
						port: 587,
						auth: {
							user: envVars.SMTP_USER.value,
							pass: envVars.SMTP_PASS.value,
						},
					},
				})
			: undefined,
	plugins: [
		searchPlugin({
			collections: [Users.slug, Courses.slug],
			searchOverrides: {
				slug: "search" as const,
				fields: ({ defaultFields }) => [
					...defaultFields,
					{
						name: "meta",
						type: "textarea",
					},
				],
			},
			beforeSync: async ({ originalDoc, searchDoc }) => {
				return {
					...searchDoc,
					meta: JSON.stringify(originalDoc, null, 2),
				};
			},
		}),
		s3Storage({
			collections: {
				media: true,
			},
			bucket: envVars.S3_BUCKET.value,
			config: {
				credentials: {
					accessKeyId: envVars.S3_ACCESS_KEY.value,
					secretAccessKey: envVars.S3_SECRET_KEY.value,
				},
				endpoint: envVars.S3_ENDPOINT_URL.value,
				region: envVars.S3_REGION.value ?? envVars.S3_REGION.default, // MinIO default region
				forcePathStyle: true, // Required for MinIO
			},
		}),
	],
	jobs: {
		// the cron queue
		autoRun: [
			{
				//     ┌───────────── (optional) second (0 - 59)
				//     │ ┌───────────── minute (0 - 59)
				// 	   │ │ ┌───────────── hour (0 - 23)
				// 	   │ │ │ ┌───────────── day of the month (1 - 31)
				// 	   │ │ │ │ ┌───────────── month (1 - 12)
				// 	   │ │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
				// 	   │ │ │ │ │ │
				// 	   │ │ │ │ │ │
				//  - '* 0 * * * *' every hour at minute 0
				//  - '* 0 0 * * *' daily at midnight
				//  - '* 0 0 * * 0' weekly at midnight on Sundays
				//  - '* 0 0 1 * *' monthly at midnight on the 1st day of the month
				//  - '* 0/5 * * * *' every 5 minutes
				//  - '* * * * * *' every second
				cron: `0 0 * * *`, // Every day at midnight
				queue: "nightly",
			},
			{
				cron: `* * * * * *`, // every second
				queue: "secondly",
			},
			{
				cron: `* * * * *`, // every minute
				queue: "minute",
			},
			{
				cron: `0 * * * *`, // every hour
				queue: "hourly",
			},
			{
				cron: "0 */3 * * *", // every 3 hours
				queue: "3-hourly",
			},
			{
				cron: "0 */6 * * *", // every 6 hours
				queue: "6-hourly",
			},
			{
				cron: "0 */12 * * *", // every 12 hours
				queue: "12-hourly",
			},
		],
		// ! this will change the database structure so you cannot be conditional here
		tasks: [],
	},
	defaultDepth: 1,
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
});

export default sanitizedConfig;
