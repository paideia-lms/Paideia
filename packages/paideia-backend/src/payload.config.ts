import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { resendAdapter } from "@payloadcms/email-resend";
import { searchPlugin } from "@payloadcms/plugin-search";
import { s3Storage } from "@payloadcms/storage-s3";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import {
	buildConfig,
	type CollectionConfig,
	type GlobalConfig,
	type TaskConfig,
} from "payload";
import { migrations } from "./migrations";
import {
	ActivityModuleGrants,
	ActivityModules,
	AssignmentSubmissions,
	Assignments,
	CategoryRoleAssignments,
	CourseActivityModuleLinks,
	CourseCategories,
	CourseGradeTables,
	CourseSections,
	Courses,
	DiscussionSubmissions,
	Discussions,
	Enrollments,
	Files,
	GradebookCategories,
	GradebookItems,
	Gradebooks,
	Groups,
	Media,
	Notes,
	Pages,
	QuizSubmissions,
	Quizzes,
	SystemGradeTable,
	UserGrades,
	Whiteboards,
} from "./collections";
import {
	AnalyticsSettings,
	AppearanceSettings,
	MaintenanceSettings,
	RegistrationSettings,
	SitePolicies,
} from "./collections/globals";
// import { envVars } from "./modules/infrastructure/services/env";
import { autoSubmitQuiz } from "./tasks/auto-submit-quiz";
// import { sandboxReset } from "./modules/infrastructure/tasks/sandbox-reset";
import { customTranslations } from "./utils/db/custom-translations";
import { RouterContextProvider } from "react-router";
import { InfrastructureModule } from "modules/infrastructure";
import { UserModule } from "modules/user";
import { NoteModule } from "modules/note";
import { CoursesModule } from "./modules/courses";


// extends the RequestContext type from payload 
declare module "payload" {
	interface RequestContext {
		routerContext?: Readonly<RouterContextProvider>;
	}
}

// extends the Request type for global
declare global {
	interface Request {
		_c?: Readonly<RouterContextProvider>;
	}
}

const pg = postgresAdapter({
	pool: {
		connectionString: InfrastructureModule.envVars.DATABASE_URL.value,
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
			// Modify foreign key constraints for activity_module_grants, course_sections, and course_activity_module_links
			const relations = [
				{
					relation: "relations_activity_module_grants",
					foreignTable: "activity_modules",
				},
				{
					relation: "relations_course_sections",
					foreignTable: "courses",
				},
				{
					relation: "relations_course_activity_module_links",
					foreignTable: "courses",
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
						// Change foreign key to CASCADE on delete for both activity_modules and courses
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

const sanitizedConfig = buildConfig({
	db: pg,
	secret: InfrastructureModule.envVars.PAYLOAD_SECRET.value,
	// ? shall we use localhost or the domain of the server
	serverURL: `http://localhost:${InfrastructureModule.envVars.PORT.value ?? InfrastructureModule.envVars.PORT.default}`,
	cors: InfrastructureModule.envVars.CORS_ORIGINS.origins,
	csrf: [
		// ! this is required for the local development to work
		...(process.env.NODE_ENV === "development"
			? ["http://localhost:3000", "localhost"]
			: ["http://localhost:3000", "localhost"]),
		...InfrastructureModule.envVars.CSRF_ORIGINS.origins,
	].filter(Boolean) as string[],
	collections: [
		...UserModule.collections,
		...InfrastructureModule.collections,
		...NoteModule.collections,
		...CoursesModule.collections,
		// Courses,
		// CourseSections,
		// CourseActivityModuleLinks,
		CourseCategories,
		CategoryRoleAssignments,
		Enrollments,
		ActivityModules,
		ActivityModuleGrants,
		Pages,
		Whiteboards,
		Assignments,
		Quizzes,
		Discussions,
		Gradebooks,
		GradebookCategories,
		GradebookItems,
		AssignmentSubmissions,
		QuizSubmissions,
		DiscussionSubmissions,
		CourseGradeTables,
		Groups,
		UserGrades,
		Files,
	] as CollectionConfig[],
	globals: [
		SystemGradeTable,
		RegistrationSettings,
		MaintenanceSettings,
		SitePolicies,
		AppearanceSettings,
		AnalyticsSettings,
	] as GlobalConfig[],

	admin: {
		// ! when you use auto login, you can never logout
		// autoLogin: process.env.NODE_ENV === "development" ? {
		// 	email: devConstants.ADMIN_EMAIL,
		// 	password: devConstants.ADMIN_PASSWORD,
		// } : undefined,
	},
	email: (() => {
		// Shared default values for both email adapters
		const defaultFromAddress =
			InfrastructureModule.envVars.EMAIL_FROM_ADDRESS.value ??
			InfrastructureModule.envVars.EMAIL_FROM_ADDRESS.default ??
			"info@paideialms.com";
		const defaultFromName =
			InfrastructureModule.envVars.EMAIL_FROM_NAME.value ??
			InfrastructureModule.envVars.EMAIL_FROM_NAME.default ??
			"Paideia LMS";

		if (InfrastructureModule.envVars.RESEND_API_KEY.value) {
			return resendAdapter({
				apiKey: InfrastructureModule.envVars.RESEND_API_KEY.value,
				defaultFromAddress,
				defaultFromName,
			});
		}

		if (
			InfrastructureModule.envVars.SMTP_HOST.value &&
			InfrastructureModule.envVars.SMTP_USER.value &&
			InfrastructureModule.envVars.SMTP_PASS.value
		) {
			return nodemailerAdapter({
				defaultFromAddress,
				defaultFromName,
				// Nodemailer transportOptions
				transportOptions: {
					host: InfrastructureModule.envVars.SMTP_HOST.value,
					port: 587,
					auth: {
						user: InfrastructureModule.envVars.SMTP_USER.value,
						pass: InfrastructureModule.envVars.SMTP_PASS.value,
					},
				},
			});
		}

		return undefined;
	})(),
	plugins: [
		searchPlugin({
			collections: [...UserModule.search, ...InfrastructureModule.search, ...NoteModule.search, ...CoursesModule.search],
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
			bucket: InfrastructureModule.envVars.S3_BUCKET.value,
			config: {
				credentials: {
					accessKeyId: InfrastructureModule.envVars.S3_ACCESS_KEY.value,
					secretAccessKey: InfrastructureModule.envVars.S3_SECRET_KEY.value,
				},
				endpoint: InfrastructureModule.envVars.S3_ENDPOINT_URL.value,
				region: InfrastructureModule.envVars.S3_REGION.value ?? InfrastructureModule.envVars.S3_REGION.default, // VaultS3 default region
				forcePathStyle: true, // Required for S3-compatible storage (VaultS3, MinIO)
			},
		}),
	],
	jobs: {
		deleteJobOnComplete: false,
		// the cron queue
		autoRun: [
			...InfrastructureModule.queues,
			...UserModule.queues,
		],
		// ! this will change the database structure so you cannot be conditional here
		tasks: [...InfrastructureModule.tasks, ...UserModule.tasks, autoSubmitQuiz] as TaskConfig[],
	},
	defaultDepth: 1,
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
	i18n: {
		translations: customTranslations,
	},
});

export default sanitizedConfig;
