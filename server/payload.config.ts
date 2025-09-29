import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { EnhancedQueryLogger } from "drizzle-query-logger";
import { type CollectionConfig, type Config, sanitizeConfig } from "payload";
import { migrations } from "src/migrations";
import { envVars } from "./env";

// Courses collection - core LMS content
export const Courses = {
	slug: "courses",
	defaultSort: "-createdAt",
	admin: {
		useAsTitle: "title",
		defaultColumns: ["title", "instructor", "difficulty", "status"],
	},
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

// Enhanced Users collection with LMS fields
export const Users = {
	auth: {
		verify: true,
	},
	admin: {
		useAsTitle: "email",
		defaultColumns: ["email", "firstName", "lastName", "role"],
	},
	fields: [
		{
			name: "firstName",
			type: "text",
		},
		{
			name: "lastName",
			type: "text",
		},
		{
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
			name: "avatar",
			type: "text",
			label: "Avatar URL",
		},
	],
	slug: "users",
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
	collections: [Users, Courses],
	typescript: {
		outputFile: path.resolve(__dirname, "./payload-types.ts"),
	},
	telemetry: false,
} satisfies Config;

const sanitizedConfig = await sanitizeConfig(config);

export default sanitizedConfig;
