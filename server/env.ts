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
    },
    // R2_URL: {
    //     required: false,
    //     sensitive: true,
    //     value: process.env.R2_URL
    // },
    // R2_ACCESS_KEY: {
    //     required: false,
    //     sensitive: true,
    //     value: process.env.R2_ACCESS_KEY,
    // },
    // R2_SECRET_KEY: {
    //     required: false,
    //     sensitive: true,
    //     value: process.env.R2_SECRET_KEY,
    // }
} as const;