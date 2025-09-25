import { envVars } from "./server/env";
import { type Config, sanitizeConfig, type CollectionConfig } from "payload";
import { postgresAdapter } from '@payloadcms/db-postgres'

for (const [key, value] of Object.entries(envVars)) {
    if (value.required && !value.value) {
        throw new Error(`${key} is not set`);
    }
}


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
    auth: true,
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
    // Postgres-specific arguments go here.
    // `pool` is required.
    pool: {
        connectionString: envVars.DATABASE_URL.value,
    },
})

const config = {
    "db": pg,
    "secret": envVars.PAYLOAD_SECRET.value,
    // ? shall we use localhost or the domain of the server
    "serverURL": `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
    collections: [Users, Courses],
    telemetry: false,
} satisfies Config;

const sanitizedConfig = await sanitizeConfig(config);

export default sanitizedConfig;