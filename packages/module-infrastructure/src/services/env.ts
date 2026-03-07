export const envVars = {
	DATABASE_URL: {
		required: true,
		sensitive: true,
		value: process.env.DATABASE_URL,
		default:
			process.env.NODE_ENV === "test"
				? "postgresql://postgres:postgres@localhost:5432/paideia_module_infrastructure_test"
				: undefined,
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
		value: process.env.S3_URL,
		default: process.env.NODE_ENV === "test" ? "http://localhost:9000" : undefined,
	},
	S3_ACCESS_KEY: {
		required: true,
		sensitive: true,
		value: process.env.S3_ACCESS_KEY,
		default: process.env.NODE_ENV === "test" ? "minioadmin" : undefined,
	},
	S3_SECRET_KEY: {
		required: true,
		sensitive: true,
		value: process.env.S3_SECRET_KEY,
		default: process.env.NODE_ENV === "test" ? "minioadmin" : undefined,
	},
	S3_REGION: {
		required: false,
		sensitive: true,
		value: process.env.S3_REGION,
		default: "us-east-1",
	},
	// ! the bucket name is the same as the bucket name in the S3-compatible storage (VaultS3) configuration
	S3_BUCKET: {
		required: false,
		sensitive: true,
		value: process.env.S3_BUCKET,
		default: process.env.NODE_ENV === "test" ? "paideia-module-user-test" : undefined,
	},
	// ! the endpoint url is the same as the endpoint url in the S3-compatible storage (VaultS3) configuration
	// ! without the bucket name
	S3_ENDPOINT_URL: {
		required: true,
		sensitive: true,
		value: process.env.S3_ENDPOINT_URL,
		default: process.env.NODE_ENV === "test" ? "http://localhost:9000" : undefined,
	},
	PAYLOAD_SECRET: {
		required: true,
		sensitive: true,
		value: process.env.PAYLOAD_SECRET,
		default:
			process.env.NODE_ENV === "test"
				? "test-secret-at-least-32-characters-long"
				: undefined,
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
	DEBUG_LOGS: {
		required: false,
		sensitive: false,
		value: process.env.DEBUG_LOGS,
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
			// If empty, return default localhost (both frontend and backend)
			if (!val || val.trim() === "") {
				return [
					`http://localhost:${envVars.FRONTEND_PORT.value ?? envVars.FRONTEND_PORT.default}`,
					`http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
				];
			}
			// If wildcard, return '*'
			if (val.trim() === "*") {
				return "*";
			}
			// Parse comma-separated URLs
			return val
				.split(",")
				.map((url) => url.trim())
				.filter(Boolean);
		},
	},
	CSRF_ORIGINS: {
		required: false,
		sensitive: false,
		value: process.env.CSRF_ORIGINS,
		default: "",
		get origins() {
			const val = this.value ?? this.default;
			// If empty, return default localhost (frontend and hostname for compatibility)
			if (!val || val.trim() === "") {
				return [
					`http://localhost:${envVars.FRONTEND_PORT.value ?? envVars.FRONTEND_PORT.default}`,
					"localhost",
				];
			}
			// Parse comma-separated URLs/domains
			// Note: Wildcard '*' is not supported for CSRF for security reasons
			return val
				.split(",")
				.map((url) => url.trim())
				.filter(Boolean);
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
	const missing: string[] = [];

	for (const [key, value] of Object.entries(envVars)) {
		const val = "value" in value ? value.value : undefined;
		const def = "default" in value ? value.default : undefined;
		if (value.required && !val && !def) {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		console.error("Missing required environment variables:");
		for (const key of missing) {
			console.error(`  - ${key}`);
		}
		process.exit(1);
	}
}
