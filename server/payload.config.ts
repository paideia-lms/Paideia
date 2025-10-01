import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
// import { EnhancedQueryLogger } from "drizzle-query-logger";
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

// Activity Modules collection - core learning activities
export const ActivityModules = {
	slug: "activity-modules",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "slug",
			type: "text",
			required: true,
			unique: true,
			label: "Unique Identifier",
		},
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
		},
	],
} satisfies CollectionConfig;

// Version Control: Branches collection
export const Branches = {
	slug: "branches",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			unique: true,
			label: "Branch Name",
		},
		{
			name: "description",
			type: "textarea",
			label: "Branch Description",
		},
		{
			name: "isDefault",
			type: "checkbox",
			defaultValue: false,
			label: "Default Branch",
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
	],
} satisfies CollectionConfig;

// Version Control: Commits collection
export const Commits = {
	slug: "commits",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "hash",
			type: "text",
			required: true,
			unique: true,
			label: "Commit Hash",
		},
		{
			name: "message",
			type: "textarea",
			required: true,
			label: "Commit Message",
		},
		{
			name: "author",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Author",
		},
		{
			name: "committer",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Committer",
		},
		{
			name: "parentCommit",
			type: "relationship",
			relationTo: "commits",
			label: "Parent Commit",
		},
		{
			name: "isMergeCommit",
			type: "checkbox",
			defaultValue: false,
			label: "Is Merge Commit",
		},
		{
			name: "commitDate",
			type: "date",
			required: true,
			label: "Commit Date",
		},
	],
} satisfies CollectionConfig;

// Version Control: Commit Parents (for merge commits with multiple parents)
export const CommitParents = {
	slug: "commit-parents",
	fields: [
		{
			name: "commit",
			type: "relationship",
			relationTo: "commits",
			required: true,
		},
		{
			name: "parentCommit",
			type: "relationship",
			relationTo: "commits",
			required: true,
		},
		{
			name: "parentOrder",
			type: "number",
			required: true,
			label: "Parent Order (0 for first parent, 1 for second, etc.)",
		},
	],
	indexes: [
		{
			fields: ["commit", "parentCommit"],
			unique: true,
		},
	],
} satisfies CollectionConfig;

// Version Control: Activity Module Versions
export const ActivityModuleVersions = {
	slug: "activity-module-versions",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "activityModule",
			type: "relationship",
			relationTo: "activity-modules",
			required: true,
		},
		{
			name: "commit",
			type: "relationship",
			relationTo: "commits",
			required: true,
		},
		{
			name: "branch",
			type: "relationship",
			relationTo: "branches",
			required: true,
		},
		{
			name: "content",
			type: "json",
			required: true,
			label: "Content (JSON/YAML)",
		},
		{
			name: "title",
			type: "text",
			required: true,
			label: "Version Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Version Description",
		},
		{
			name: "isCurrentHead",
			type: "checkbox",
			defaultValue: false,
			label: "Is Current Head",
		},
		{
			name: "contentHash",
			type: "text",
			label: "Content Hash (for integrity)",
		},
	],
	indexes: [
		{
			fields: ["activityModule", "commit", "branch"],
			unique: true,
		},
		{
			fields: ["activityModule", "branch", "isCurrentHead"],
		},
	],
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
	// logger: process.env.NODE_ENV !== "production" ? new EnhancedQueryLogger() : undefined
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
		ActivityModules,
		Branches,
		Commits,
		CommitParents,
		ActivityModuleVersions,
		Tags,
	] as CollectionConfig[],
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
} satisfies Config;

const sanitizedConfig = await sanitizeConfig(config);

export default sanitizedConfig;
