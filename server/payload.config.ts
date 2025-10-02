import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import { type CollectionConfig, type Config, sanitizeConfig } from "payload";
import { migrations } from "src/migrations";
import { UnauthorizedError } from "~/utils/error";
import { envVars } from "./env";

// Courses collection - core LMS content
export const Courses = {
	slug: "courses",
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
			type: "text",
			label: "Thumbnail URL",
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
			type: "text",
			label: "Avatar URL",
		},
	],
	slug: "users",
} satisfies CollectionConfig;

// Origins collection - tracks the root of activity module branches
export const Origins = {
	slug: "origins",
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
			defaultSort: "-createdAt",
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
	push:
		process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production",
});

const __dirname = import.meta.dirname;

const config = {
	db: pg,
	secret: envVars.PAYLOAD_SECRET.value,
	// ? shall we use localhost or the domain of the server
	serverURL: `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
	collections: [
		Users,
		Courses,
		Enrollments,
		Origins,
		ActivityModules,
		Commits,
		Tags,
	] as CollectionConfig[],
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
} satisfies Config;

const sanitizedConfig = await sanitizeConfig(config);

export default sanitizedConfig;
