export const envVars = {
	DATABASE_URL: {
		required: true,
		sensitive: true,
		value: process.env.DATABASE_URL!,
	},
	PORT: {
		required: false,
		sensitive: true,
		value: process.env.PORT,
		default: 3001,
	},
	FRONTEND_PORT: {
		required: false,
		sensitive: true,
		value: process.env.FRONTEND_PORT,
		default: 3000,
	},
	S3_URL: {
		required: true,
		sensitive: true,
		value: process.env.S3_URL!,
	},
	S3_ACCESS_KEY: {
		required: true,
		sensitive: true,
		value: process.env.S3_ACCESS_KEY!,
	},
	S3_SECRET_KEY: {
		required: true,
		sensitive: true,
		value: process.env.S3_SECRET_KEY!,
	},
	S3_REGION: {
		required: false,
		sensitive: true,
		value: process.env.S3_REGION,
		default: "us-east-1",
	},
	PAYLOAD_SECRET: {
		required: true,
		sensitive: true,
		value: process.env.PAYLOAD_SECRET!,
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

export function validateEnvVars() {
	for (const [key, value] of Object.entries(envVars)) {
		if (value.required && !value.value) {
			throw new Error(`${key} is not set`);
		}
	}
}
