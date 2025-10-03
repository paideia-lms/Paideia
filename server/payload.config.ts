import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { searchPlugin } from "@payloadcms/plugin-search";
import { s3Storage } from "@payloadcms/storage-s3";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import { buildConfig, type CollectionConfig, TaskConfig } from "payload";
import sharp from "sharp";
import { migrations } from "src/migrations";
import { UnauthorizedError } from "~/utils/error";
import { envVars } from "./env";

// Courses collection - core LMS content
export const Courses = {
	slug: "courses" as const,
	defaultSort: "-createdAt",
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			name: "description",
			type: "textarea",
			required: true,
		},
		{
			name: "instructor",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "difficulty",
			type: "select",
			options: [
				{ label: "Beginner", value: "beginner" },
				{ label: "Intermediate", value: "intermediate" },
				{ label: "Advanced", value: "advanced" },
			],
			defaultValue: "beginner",
		},
		{
			name: "duration",
			type: "number",
			label: "Duration (minutes)",
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
				{ label: "Archived", value: "archived" },
			],
			defaultValue: "draft",
		},
		{
			name: "thumbnail",
			type: "relationship",
			relationTo: "media",
			label: "Thumbnail",
		},
		{
			name: "tags",
			type: "array",
			fields: [
				{
					name: "tag",
					type: "text",
				},
			],
		},
	],
} satisfies CollectionConfig;

// Enrollments collection - links users to courses with specific roles
export const Enrollments = {
	slug: "enrollments",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "user",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
		},
		{
			// ! we don't allow multiple roles in a course
			name: "role",
			type: "select",
			options: [
				{ label: "Student", value: "student" },
				{ label: "Teacher", value: "teacher" },
				{ label: "Teaching Assistant", value: "ta" },
				{ label: "Manager", value: "manager" },
			],
			required: true,
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Active", value: "active" },
				{ label: "Inactive", value: "inactive" },
				{ label: "Completed", value: "completed" },
				{ label: "Dropped", value: "dropped" },
			],
			defaultValue: "active",
		},
		{
			name: "enrolledAt",
			type: "date",
		},
		{
			name: "completedAt",
			type: "date",
		},
	],
	hooks: {
		beforeOperation: [
			({ collection, operation, req }) => {
				// Skip authentication in test environment
				if (process.env.NODE_ENV === "test") return;

				const user = req.user;
				console.log("beforeOperation", collection, operation, user);
				if (!user) throw new UnauthorizedError("Unauthorized");
			},
		],
	},
	// Ensure unique user-course combinations
	indexes: [
		{
			fields: ["user", "course"],
			unique: true,
		},
	],
} satisfies CollectionConfig;

// Enhanced Users collection with LMS fields
export const Users = {
	auth: {
		verify: true,
	},
	fields: [
		{
			saveToJWT: true,
			name: "firstName",
			type: "text",
		},
		{
			saveToJWT: true,
			name: "lastName",
			type: "text",
		},
		{
			saveToJWT: true,
			name: "role",
			type: "select",
			options: [
				{ label: "Student", value: "student" },
				{ label: "Instructor", value: "instructor" },
				{ label: "Admin", value: "admin" },
			],
			defaultValue: "student",
		},
		{
			name: "bio",
			type: "textarea",
		},
		{
			saveToJWT: true,
			name: "avatar",
			type: "relationship",
			relationTo: "media",
			label: "Avatar",
		},
	],
	slug: "users" as const,
} satisfies CollectionConfig;

// Origins collection - tracks the root of activity module branches
export const Origins = {
	slug: "origins" as const,
	defaultSort: "-createdAt",
	fields: [
		{
			name: "branches",
			type: "join",
			on: "origin",
			collection: "activity-modules",
			label: "Activity Module Branches",
			hasMany: true,
			defaultSort: "-createdAt",
			defaultLimit: 999999,
			maxDepth: 2,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			maxDepth: 2,
		},
	],
} satisfies CollectionConfig;

// Activity Modules collection - core learning activities
export const ActivityModules = {
	slug: "activity-modules",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			name: "description",
			type: "textarea",
		},
		{
			/**
			 * the current branch name
			 */
			name: "branch",
			type: "text",
			required: true,
			defaultValue: "main",
			label: "Branch Name",
		},
		{
			// ! this is the origin that this activity module belongs to
			// ! all branches of the same activity module share the same origin
			name: "origin",
			type: "relationship",
			relationTo: "origins",
			label: "Origin",
			required: true,
		},
		{
			name: "commits",
			type: "join",
			on: "activityModule",
			collection: "commits",
			label: "Commits",
			hasMany: true,
			// ! this is sorted by commit date but not created at
			defaultSort: "-commitDate",
			defaultLimit: 999999,
			maxDepth: 2,
		},
		{
			name: "type",
			type: "select",
			options: [
				{ label: "Page", value: "page" },
				{ label: "Whiteboard", value: "whiteboard" },
				{ label: "Assignment", value: "assignment" },
				{ label: "Quiz", value: "quiz" },
				{ label: "Discussion", value: "discussion" },
			],
			required: true,
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
				{ label: "Archived", value: "archived" },
			],
			defaultValue: "draft",
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			maxDepth: 2,
		},
	],
	indexes: [
		{
			// branches will be unique by origin
			fields: ["branch", "origin"],
			unique: true,
		},
	],
} satisfies CollectionConfig;

/**
 * a commit is arbitrary content with a hash to previous commit and some other commit details
 */
export const Commits = {
	slug: "commits",
	defaultSort: "-createdAt",
	fields: [
		{
			/**
			 * this is the hash of the content
			 */
			name: "hash",
			type: "text",
			required: true,
			unique: true,
			label: "Commit Hash",
		},
		{
			name: "activityModule",
			type: "relationship",
			relationTo: "activity-modules",
			label: "Activity Module",
			hasMany: true,
			maxDepth: 2,
		},
		{
			name: "message",
			type: "textarea",
			required: true,
			label: "Commit Message",
		},
		{
			// ! we don't need to store the committer because auther and committer are the same
			name: "author",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Author",
		},
		{
			// ! if this is null, this is the first commit of the branch
			name: "parentCommit",
			type: "relationship",
			relationTo: "commits",
			label: "Parent Commit",
		},
		{
			name: "commitDate",
			type: "date",
			required: true,
			label: "Commit Date",
		},
		{
			name: "content",
			type: "json",
			required: true,
			label: "Content (JSON)",
		},
		{
			name: "contentHash",
			type: "text",
			required: true,
			label: "Content Hash (for integrity)",
		},
	],
	// ! we don't need timestamps for commits because we have commit date
	timestamps: false,
	indexes: [],
} satisfies CollectionConfig;

// Version Control: Tags (for marking specific versions)
export const Tags = {
	slug: "tags",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			unique: true,
			label: "Tag Name",
		},
		{
			name: "description",
			type: "textarea",
			label: "Tag Description",
		},
		{
			name: "commit",
			type: "relationship",
			relationTo: "commits",
			required: true,
		},
		{
			name: "origin",
			type: "relationship",
			relationTo: "origins",
			required: true,
		},
		{
			name: "tagType",
			type: "select",
			options: [
				{ label: "Release", value: "release" },
				{ label: "Milestone", value: "milestone" },
				{ label: "Snapshot", value: "snapshot" },
			],
			defaultValue: "snapshot",
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
	],
	indexes: [
		{
			// tags will be unique by origin
			fields: ["name", "origin"],
			unique: true,
		},
	],
} satisfies CollectionConfig;

export const MergeRequests = {
	slug: "merge-requests",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			name: "description",
			type: "textarea",
		},
		{
			name: "from",
			type: "relationship",
			relationTo: "activity-modules",
			required: true,
		},
		{
			name: "to",
			type: "relationship",
			relationTo: "activity-modules",
			required: true,
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Open", value: "open" },
				{ label: "Merged", value: "merged" },
				{ label: "Rejected", value: "rejected" },
				// ! closed by user
				{ label: "Closed", value: "closed" },
			],
			defaultValue: "open",
		},
		{
			name: "comments",
			type: "join",
			on: "mergeRequest",
			collection: "merge-request-comments",
			label: "Comments",
			hasMany: true,
			maxDepth: 2,
		},
		{
			name: "rejectedAt",
			type: "date",
		},
		{
			name: "rejectedBy",
			type: "relationship",
			relationTo: "users",
		},
		{
			name: "mergedAt",
			type: "date",
		},
		{
			name: "mergedBy",
			type: "relationship",
			relationTo: "users",
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "closedAt",
			type: "date",
			label: "Closed At",
		},
		{
			name: "closedBy",
			type: "relationship",
			relationTo: "users",
			label: "Closed By",
		},
		{
			name: "allowComments",
			type: "checkbox",
			label: "Allow Comments",
			defaultValue: true,
		},
	],
	indexes: [
		// ! this is not a constraint because we can have mulitple closed merge requests between the same two activity modules
		// {
		// 	// ! the pair needs to be unique
		// 	fields: ["from", "to"],
		// 	unique: true,
		// },
	],
} satisfies CollectionConfig;

export const MergeRequestComments = {
	slug: "merge-request-comments",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "comment",
			type: "textarea",
			required: true,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "mergeRequest",
			type: "relationship",
			relationTo: "merge-requests",
			required: true,
		},
	],
	indexes: [
		{
			fields: ["mergeRequest"],
			unique: true,
		},
	],
} satisfies CollectionConfig;

// Media collection for file uploads with S3 storage
export const Media = {
	slug: "media",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "alt",
			type: "text",
			label: "Alt Text",
		},
		{
			name: "caption",
			type: "textarea",
			label: "Caption",
		},
	],
	upload: {
		disableLocalStorage: true,
		imageSizes: [
			{
				name: "thumbnail",
				width: 400,
				height: 300,
				position: "centre",
			},
			{
				name: "card",
				width: 768,
				height: 1024,
				position: "centre",
			},
			{
				name: "tablet",
				width: 1024,
				height: undefined,
				position: "centre",
			},
		],
		adminThumbnail: "thumbnail",
	},
} satisfies CollectionConfig;

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
		Enrollments,
		Origins,
		ActivityModules,
		Commits,
		Tags,
		MergeRequests,
		MergeRequestComments,
		Media,
	] as CollectionConfig[],
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
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
});

export default sanitizedConfig;
