import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { searchPlugin } from "@payloadcms/plugin-search";
import { s3Storage } from "@payloadcms/storage-s3";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import type { JSONSchema4 } from "json-schema";
import {
	buildConfig,
	type CollectionConfig,
	type TextFieldValidation,
} from "payload";
import sharp from "sharp";
import { migrations } from "src/migrations";
import z from "zod";
import { UnauthorizedError } from "~/utils/error";
import { envVars } from "./env";

const courseStructureSchema = z.object({
	sections: z.array(
		z.object({
			title: z.string(),
			description: z.string(),
			lessons: z.array(
				z.object({
					title: z.string(),
					description: z.string(),
				}),
			),
		}),
	),
});

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
			// ! e.g. 'math-101-a-fa-2025'
			name: "slug",
			type: "text",
			required: true,
			unique: true,
			label: "Slug",
			validate: ((value) => {
				// only allow lowercase letters, numbers, and hyphens
				if (value && !/^[a-z0-9-]+$/.test(value)) {
					return "Slug must contain only lowercase letters, numbers, and hyphens";
				}
				return true as const;
			}) as TextFieldValidation,
		},
		{
			name: "description",
			type: "textarea",
			required: true,
		},
		{
			name: "structure",
			type: "json",
			required: true,
			label: "Structure",
			validate: (value) => {
				const result = courseStructureSchema.safeParse(value);
				if (!result.success) {
					console.log("test", z.formatError(result.error)._errors.join(", "));
					return z.formatError(result.error)._errors.join(", ");
				}
				return true;
			},
			typescriptSchema: [
				() => z.toJSONSchema(courseStructureSchema) as JSONSchema4,
			],
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
			required: true,
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
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "gradebook",
			type: "join",
			on: "course",
			collection: "gradebooks",
			label: "Gradebook",
			hasMany: false,
		},
	],
} as const satisfies CollectionConfig;

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
			name: "userEmail",
			type: "text",
			virtual: `user.email`,
		},
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
		},
		{
			name: "courseSlug",
			type: "text",
			virtual: `course.${Courses.fields[1].name}`,
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `course.${Courses.fields[0].name}`,
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
			required: true,
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
} as const satisfies CollectionConfig;

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
} as const satisfies CollectionConfig;

// Origins collection - tracks the root of activity module branches
export const Origins = {
	slug: "origins" as const,
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
			name: "branches",
			type: "join",
			on: "origin",
			collection: "activity-modules",
			label: "Activity Module Branches",
			hasMany: true,
			defaultSort: "-createdAt",
			defaultLimit: 999999,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
	],
} as const satisfies CollectionConfig;

// Activity Modules collection - core learning activities
export const ActivityModules = {
	slug: "activity-modules",
	defaultSort: "-createdAt",
	fields: [
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
			name: "title",
			type: "text",
			virtual: `origin.${Origins.fields[0].name}`,
		},
		{
			name: "description",
			type: "textarea",
			virtual: `origin.${Origins.fields[1].name}`,
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
			required: true,
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
			// branches will be unique by origin
			fields: ["branch", "origin"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;

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
			name: "parentCommitHash",
			type: "text",
			label: "Parent Commit Hash",
			virtual: `parentCommit.hash`,
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
} as const satisfies CollectionConfig;

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
} as const satisfies CollectionConfig;

/**
 * we need a new collection rather than just a relationship field on the course and commit
 */
export const CourseActivityModuleCommitLinks = {
	slug: "course-activity-module-commit-links",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			label: "Course",

			required: true,
		},
		{
			name: "courseName",
			type: "text",
			virtual: `course.${Courses.fields[0].name}`,
		},
		{
			name: "courseSlug",
			type: "text",
			virtual: `course.${Courses.fields[1].name}`,
		},
		{
			name: "commit",
			type: "relationship",
			relationTo: "commits",
			label: "Commit",

			required: true,
		},
		{
			name: "activityModuleName",
			type: "text",
			hasMany: true,
			virtual: `commit.${Commits.fields[1].name}.${ActivityModules.fields[1].name}.${Origins.fields[0].name}`,
		},
	],
} as const satisfies CollectionConfig;

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
			required: true,
		},
		{
			name: "comments",
			type: "join",
			on: "mergeRequest",
			collection: "merge-request-comments",
			label: "Comments",
			hasMany: true,
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
} as const satisfies CollectionConfig;

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
} as const satisfies CollectionConfig;

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
} as const satisfies CollectionConfig;

/**
 * notes are like journals and tweets
 * it is pure markdown content.
 *
 * ! in the future, we might version control the notes
 */
export const Notes = {
	slug: "notes" as const,
	defaultSort: "-createdAt",
	fields: [
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
		{
			name: "content",
			type: "textarea",
			required: true,
		},
	],
} as const satisfies CollectionConfig;

// Gradebooks collection - manages gradebooks for courses
export const Gradebooks = {
	slug: "gradebooks",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `course.${Courses.fields[0].name}`,
			label: "Course Title",
		},
		{
			/**
			 * ! we allow a gradebook to be disabled
			 */
			name: "enabled",
			type: "checkbox",
			label: "Enabled",
			defaultValue: true,
		},
		{
			name: "categories",
			type: "join",
			on: "gradebook",
			collection: "gradebook-categories",
			label: "Categories",
			hasMany: true,
		},
		{
			name: "items",
			type: "join",
			on: "gradebook",
			collection: "gradebook-items",
			label: "Grade Items",
			hasMany: true,
		},
	],
	indexes: [
		{
			// One gradebook per course
			fields: ["course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;

// Gradebook Categories collection - hierarchical categories within gradebooks
export const GradebookCategories = {
	slug: "gradebook-categories",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "gradebook",
			type: "relationship",
			relationTo: "gradebooks",
			required: true,
			label: "Gradebook",
		},
		{
			name: "parent",
			type: "relationship",
			relationTo: "gradebook-categories",
			label: "Parent Category",
		},
		{
			name: "name",
			type: "text",
			required: true,
			label: "Category Name",
		},
		{
			name: "description",
			type: "textarea",
			label: "Description",
		},
		{
			name: "weight",
			type: "number",
			label: "Weight (%)",
			defaultValue: 0,
			min: 0,
			max: 100,
		},
		// sort_order BIGINT(19) NOT NULL DEFAULT 0, -- Order within parent context
		{
			name: "sortOrder",
			type: "number",
			label: "Sort Order",
			required: true,
		},
		{
			name: "subcategories",
			type: "join",
			on: "parent",
			collection: "gradebook-categories",
			label: "Subcategories",
			hasMany: true,
		},
		{
			name: "items",
			type: "join",
			on: "category",
			collection: "gradebook-items",
			label: "Grade Items",
			hasMany: true,
		},
	],
	indexes: [
		{
			fields: ["gradebook"],
		},
		{
			fields: ["parent"],
		},
	],
} as const satisfies CollectionConfig;

// Gradebook Items collection - individual gradeable items
export const GradebookItems = {
	slug: "gradebook-items",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "gradebook",
			type: "relationship",
			relationTo: "gradebooks",
			required: true,
			label: "Gradebook",
		},
		{
			name: "category",
			type: "relationship",
			relationTo: "gradebook-categories",
			label: "Category",
		},
		{
			// ! this is the manual item name
			name: "name",
			type: "text",
			required: true,
			label: "Item Name",
		},
		{
			name: "sortOrder",
			type: "number",
			required: true,
			label: "Sort Order",
		},
		{
			name: "description",
			type: "textarea",
			label: "Description",
		},
		{
			name: "activityModule",
			type: "relationship",
			relationTo: "course-activity-module-commit-links",
			label: "Active Module",
		},
		{
			name: "activityModuleName",
			type: "text",
			virtual: `activityModule.${CourseActivityModuleCommitLinks.fields[4].name}`,
			label: "Activity Module Name",
		},
		{
			name: "maxGrade",
			type: "number",
			required: true,
			defaultValue: 100,
			label: "Maximum Grade",
			min: 0,
		},
		{
			name: "minGrade",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Minimum Grade",
			min: 0,
		},
		{
			name: "weight",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Weight (%)",
			min: 0,
			max: 100,
		},
		{
			name: "extraCredit",
			type: "checkbox",
			defaultValue: false,
			label: "Extra Credit",
		},
		{
			name: "userGrades",
			type: "join",
			on: "gradebookItem",
			collection: "user-grades",
			label: "User Grades",
			hasMany: true,
		},
	],
	indexes: [
		{
			fields: ["gradebook"],
		},
		{
			fields: ["category"],
		},
	],
} as const satisfies CollectionConfig;

// User Grades collection - individual grades for users
export const UserGrades = {
	slug: "user-grades",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "user",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "User",
		},
		{
			name: "gradebookItem",
			type: "relationship",
			relationTo: "gradebook-items",
			required: true,
			label: "Gradebook Item",
		},
		{
			name: "grade",
			type: "number",
			label: "Grade",
			min: 0,
		},
		{
			name: "feedback",
			type: "textarea",
			label: "Feedback",
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Not Graded", value: "not_graded" },
				{ label: "Graded", value: "graded" },
				{ label: "Excused", value: "excused" },
				{ label: "Missing", value: "missing" },
			],
			defaultValue: "not_graded",
			required: true,
		},
		{
			name: "gradedBy",
			type: "relationship",
			relationTo: "users",
			label: "Graded By",
		},
		{
			name: "gradedAt",
			type: "date",
			label: "Graded At",
		},
		{
			name: "submittedAt",
			type: "date",
			label: "Submitted At",
		},
	],
	indexes: [
		{
			// One grade per user per item
			fields: ["user", "gradebookItem"],
			unique: true,
		},
		{
			fields: ["gradebookItem"],
		},
		{
			fields: ["user"],
		},
	],
} as const satisfies CollectionConfig;

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
		CourseActivityModuleCommitLinks,
		MergeRequests,
		MergeRequestComments,
		Media,
		Notes,
		Gradebooks,
		GradebookCategories,
		GradebookItems,
		UserGrades,
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
	defaultDepth: 1,
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
});

export default sanitizedConfig;
