export const envVars = {
    DATABASE_URL: {
        required: true,
        sensitive: true,
        value: process.env.DATABASE_URL!
    },
    S3_URL: {
        required: true,
        sensitive: true,
        value: process.env.S3_URL!
    },
    S3_ACCESS_KEY: {
        required: true,
        sensitive: true,
        value: process.env.S3_ACCESS_KEY!
    },
    S3_SECRET_KEY: {
        required: true,
        sensitive: true,
        value: process.env.S3_SECRET_KEY!
    }
} as const;