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
	// ! the bucket name is the same as the bucket name in the MinIO configuration
	S3_BUCKET: {
		required: false,
		sensitive: true,
		value: process.env.S3_BUCKET!,
	},
	// ! the endpoint url is the same as the endpoint url in the MinIO configuration
	// ! without the bucket name
	S3_ENDPOINT_URL: {
		required: true,
		sensitive: true,
		value: process.env.S3_ENDPOINT_URL!,
	},
	PAYLOAD_SECRET: {
		required: true,
		sensitive: true,
		value: process.env.PAYLOAD_SECRET!,
	},
	SMTP_HOST: {
		required: false,
		sensitive: true,
		value: process.env.SMTP_HOST,
	},
	SMTP_USER: {
		required: false,
		sensitive: true,
		value: process.env.SMTP_USER,
	},
	SMTP_PASS: {
		required: false,
		sensitive: true,
		value: process.env.SMTP_PASS,
	},
	RESEND_API_KEY: {
		required: false,
		sensitive: true,
		value: process.env.RESEND_API_KEY,
	},
	EMAIL_FROM_ADDRESS: {
		required: false,
		sensitive: false,
		value: process.env.EMAIL_FROM_ADDRESS,
		default: "info@paideialms.com",
	},
	EMAIL_FROM_NAME: {
		required: false,
		sensitive: false,
		value: process.env.EMAIL_FROM_NAME,
		default: "Paideia LMS",
	},
	SANDBOX_MODE: {
		required: false,
		sensitive: false,
		value: process.env.SANDBOX_MODE,
		default: "0",
		get enabled() {
			const val = this.value ?? this.default;
			return val === "1" || val === "true";
		},
	},
	CORS_ORIGINS: {
		required: false,
		sensitive: false,
		value: process.env.CORS_ORIGINS,
		default: "",
		get origins() {
			const val = this.value ?? this.default;
			// If empty, return default localhost
			if (!val || val.trim() === "") {
				return [
					`http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
				];
			}
			// If wildcard, return '*'
			if (val.trim() === "*") {
				return "*";
			}
			// Parse comma-separated URLs
			return val.split(",").map((url) => url.trim()).filter(Boolean);
		},
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
