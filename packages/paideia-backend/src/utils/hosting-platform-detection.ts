/**
 * Platform Detection Utility
 * Detects the underlying hosting platform based on environment variables
 */

// Platform Detection Types
export enum DeploymentPlatform {
	COOLIFY = "coolify",
	FLY_IO = "fly.io",
	CLOUDFLARE = "cloudflare",
	GOOGLE_CLOUD_RUN = "google-cloud-run",
	RAILWAY = "railway",
	RENDER = "render",
	VERCEL = "vercel",
	NETLIFY = "netlify",
	DOCKER = "docker",
	KUBERNETES = "kubernetes",
	UNKNOWN = "unknown",
}

export interface PlatformInfo {
	platform: DeploymentPlatform;
	region?: string;
	instanceId?: string;
	appName?: string;
	version?: string;
	metadata: Record<string, string>;
}

export interface PlatformDetectionResult {
	detected: boolean;
	platform: DeploymentPlatform;
	confidence: "high" | "medium" | "low";
	info: PlatformInfo;
	environmentVariables: Record<string, string>;
}

interface PlatformDetector {
	name: DeploymentPlatform;
	detect: (env: Record<string, string>) => boolean;
	extractInfo: (env: Record<string, string>) => PlatformInfo;
	confidence: "high" | "medium" | "low";
}

const platformDetectors: PlatformDetector[] = [
	// Coolify - Medium confidence detection (requires custom env var)
	{
		name: DeploymentPlatform.COOLIFY,
		detect: (env) =>
			!!(
				env.COOLIFY_FQDN ||
				env.COOLIFY_URL ||
				env.COOLIFY_BRANCH ||
				env.COOLIFY_RESOURCE_UUID
			),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.COOLIFY,
			region: env.COOLIFY_REGION,
			instanceId: env.COOLIFY_RESOURCE_UUID || env.COOLIFY_CONTAINER_NAME,
			appName: env.COOLIFY_APP_NAME,
			version: env.SOURCE_COMMIT,
			metadata: {
				fqdn: env.COOLIFY_FQDN || "",
				url: env.COOLIFY_URL || "",
				branch: env.COOLIFY_BRANCH || "",
				resourceUuid: env.COOLIFY_RESOURCE_UUID || "",
				containerName: env.COOLIFY_CONTAINER_NAME || "",
				sourceCommit: env.SOURCE_COMMIT || "",
				host: env.HOST || "",
				port: env.PORT || "",
			},
		}),
		confidence: "medium",
	},

	// Fly.io - High confidence detection
	{
		name: DeploymentPlatform.FLY_IO,
		detect: (env) =>
			!!(env.FLY_APP_NAME || env.FLY_MACHINE_ID || env.FLY_REGION),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.FLY_IO,
			region: env.FLY_REGION,
			instanceId: env.FLY_MACHINE_ID || env.FLY_ALLOC_ID,
			appName: env.FLY_APP_NAME,
			version: env.FLY_MACHINE_VERSION,
			metadata: {
				publicIp: env.FLY_PUBLIC_IP || "",
				privateIp: env.FLY_PRIVATE_IP || "",
				imageRef: env.FLY_IMAGE_REF || "",
				processGroup: env.FLY_PROCESS_GROUP || "",
				vmMemoryMb: env.FLY_VM_MEMORY_MB || "",
				primaryRegion: env.PRIMARY_REGION || "",
			},
		}),
		confidence: "high",
	},

	// Cloudflare Containers - High confidence detection
	{
		name: DeploymentPlatform.CLOUDFLARE,
		detect: (env) =>
			!!(env.CF_INSTANCE_ID || env.CF_RAY || env.CLOUDFLARE_APPLICATION_ID),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.CLOUDFLARE,
			region: env.CLOUDFLARE_REGION || env.CF_REGION,
			instanceId: env.CF_INSTANCE_ID || env.CLOUDFLARE_APPLICATION_ID,
			appName: env.CLOUDFLARE_APP_NAME,
			version: env.CF_DEPLOYMENT_ID,
			metadata: {
				cfRay: env.CF_RAY || "",
				cfConnectingIp: env.CF_CONNECTING_IP || "",
				cfIpCountry: env.CF_IPCOUNTRY || "",
				cfVisitor: env.CF_VISITOR || "",
			},
		}),
		confidence: "high",
	},

	// Google Cloud Run - High confidence detection
	{
		name: DeploymentPlatform.GOOGLE_CLOUD_RUN,
		detect: (env) => !!(env.K_SERVICE || env.K_REVISION || env.K_CONFIGURATION),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.GOOGLE_CLOUD_RUN,
			region: env.GOOGLE_CLOUD_REGION || env.GCLOUD_REGION,
			instanceId: env.CLOUD_RUN_TASK_INDEX || env.CLOUD_RUN_EXECUTION,
			appName: env.K_SERVICE,
			version: env.K_REVISION,
			metadata: {
				configuration: env.K_CONFIGURATION || "",
				project: env.GOOGLE_CLOUD_PROJECT || env.GCP_PROJECT || "",
				taskIndex: env.CLOUD_RUN_TASK_INDEX || "",
				taskCount: env.CLOUD_RUN_TASK_COUNT || "",
				execution: env.CLOUD_RUN_EXECUTION || "",
				port: env.PORT || "8080",
			},
		}),
		confidence: "high",
	},

	// Railway - High confidence detection
	{
		name: DeploymentPlatform.RAILWAY,
		detect: (env) =>
			!!(
				env.RAILWAY_ENVIRONMENT ||
				env.RAILWAY_PROJECT_ID ||
				env.RAILWAY_SERVICE_ID
			),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.RAILWAY,
			region: env.RAILWAY_REGION,
			instanceId: env.RAILWAY_REPLICA_ID || env.RAILWAY_SERVICE_ID,
			appName: env.RAILWAY_SERVICE_NAME || env.RAILWAY_PROJECT_NAME,
			version: env.RAILWAY_DEPLOYMENT_ID,
			metadata: {
				environment: env.RAILWAY_ENVIRONMENT || "",
				projectId: env.RAILWAY_PROJECT_ID || "",
				serviceId: env.RAILWAY_SERVICE_ID || "",
				deploymentId: env.RAILWAY_DEPLOYMENT_ID || "",
				gitCommitSha: env.RAILWAY_GIT_COMMIT_SHA || "",
				gitBranch: env.RAILWAY_GIT_BRANCH || "",
			},
		}),
		confidence: "high",
	},

	// Render - High confidence detection
	{
		name: DeploymentPlatform.RENDER,
		detect: (env) =>
			!!(env.RENDER || env.RENDER_SERVICE_ID || env.RENDER_SERVICE_NAME),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.RENDER,
			region: env.RENDER_REGION,
			instanceId: env.RENDER_INSTANCE_ID || env.RENDER_SERVICE_ID,
			appName: env.RENDER_SERVICE_NAME,
			version: env.RENDER_GIT_COMMIT,
			metadata: {
				serviceId: env.RENDER_SERVICE_ID || "",
				externalUrl: env.RENDER_EXTERNAL_URL || "",
				gitCommit: env.RENDER_GIT_COMMIT || "",
				gitBranch: env.RENDER_GIT_BRANCH || "",
				serviceType: env.RENDER_SERVICE_TYPE || "",
			},
		}),
		confidence: "high",
	},

	// Vercel - High confidence detection
	{
		name: DeploymentPlatform.VERCEL,
		detect: (env) => !!(env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.VERCEL,
			region: env.VERCEL_REGION,
			instanceId: env.VERCEL_DEPLOYMENT_ID,
			appName: env.VERCEL_PROJECT_PRODUCTION_URL,
			version: env.VERCEL_GIT_COMMIT_SHA,
			metadata: {
				env: env.VERCEL_ENV || "",
				url: env.VERCEL_URL || "",
				gitCommitSha: env.VERCEL_GIT_COMMIT_SHA || "",
				gitCommitMessage: env.VERCEL_GIT_COMMIT_MESSAGE || "",
				gitBranch: env.VERCEL_GIT_COMMIT_REF || "",
			},
		}),
		confidence: "high",
	},

	// Netlify - High confidence detection
	{
		name: DeploymentPlatform.NETLIFY,
		detect: (env) => !!(env.NETLIFY || env.NETLIFY_DEV || env.DEPLOY_ID),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.NETLIFY,
			region: env.AWS_REGION || env.AWS_DEFAULT_REGION,
			instanceId: env.DEPLOY_ID,
			appName: env.SITE_NAME,
			version: env.COMMIT_REF,
			metadata: {
				deployId: env.DEPLOY_ID || "",
				siteName: env.SITE_NAME || "",
				deployUrl: env.DEPLOY_URL || "",
				deployPrimeUrl: env.DEPLOY_PRIME_URL || "",
				context: env.CONTEXT || "",
				branch: env.BRANCH || "",
				commitRef: env.COMMIT_REF || "",
			},
		}),
		confidence: "high",
	},

	// Kubernetes - Medium confidence detection
	{
		name: DeploymentPlatform.KUBERNETES,
		detect: (env) =>
			!!(
				env.KUBERNETES_SERVICE_HOST ||
				env.KUBERNETES_PORT ||
				env.HOSTNAME?.includes("-")
			),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.KUBERNETES,
			region: env.KUBE_NODE_NAME || env.NODE_NAME,
			instanceId: env.HOSTNAME,
			appName: env.KUBE_APP_NAME || env.APP_NAME,
			version: env.KUBE_APP_VERSION || env.APP_VERSION,
			metadata: {
				namespace: env.KUBE_NAMESPACE || env.POD_NAMESPACE || "",
				podName: env.HOSTNAME || env.POD_NAME || "",
				nodeName: env.KUBE_NODE_NAME || env.NODE_NAME || "",
				serviceHost: env.KUBERNETES_SERVICE_HOST || "",
				servicePort: env.KUBERNETES_PORT || "",
			},
		}),
		confidence: "medium",
	},

	// Docker - Low confidence detection (generic container indicators)
	{
		name: DeploymentPlatform.DOCKER,
		detect: (env) =>
			!!(
				env.DOCKER_CONTAINER ||
				env.container ||
				(env.HOSTNAME && env.HOSTNAME.length === 12)
			),
		extractInfo: (env) => ({
			platform: DeploymentPlatform.DOCKER,
			instanceId: env.HOSTNAME,
			metadata: {
				hostname: env.HOSTNAME || "",
				container: env.container || "",
				dockerContainer: env.DOCKER_CONTAINER || "",
			},
		}),
		confidence: "low",
	},
];

/**
 * Detects the current deployment platform based on environment variables
 */
export function detectPlatform(
	_env?: Record<string, string>,
): PlatformDetectionResult {
	const env = _env ?? (process.env as Record<string, string>);
	const envRecord: Record<string, string> = {};

	// Convert environment variables to record, filtering out undefined values
	for (const [key, value] of Object.entries(env)) {
		if (value !== undefined) {
			envRecord[key] = value;
		}
	}

	// Try each detector in order of confidence
	const sortedDetectors = [...platformDetectors].sort((a, b) => {
		const confidenceOrder = { high: 3, medium: 2, low: 1 };
		return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
	});

	for (const detector of sortedDetectors) {
		if (detector.detect(envRecord)) {
			const info = detector.extractInfo(envRecord);
			return {
				detected: true,
				platform: detector.name,
				confidence: detector.confidence,
				info,
				environmentVariables: envRecord,
			};
		}
	}

	// No platform detected
	return {
		detected: false,
		platform: DeploymentPlatform.UNKNOWN,
		confidence: "low",
		info: {
			platform: DeploymentPlatform.UNKNOWN,
			metadata: {},
		},
		environmentVariables: envRecord,
	};
}

/**
 * Gets platform-specific configuration optimizations
 * @knipignore
 */
export function getPlatformOptimizations(
	platform: DeploymentPlatform,
): Record<string, unknown> {
	switch (platform) {
		case DeploymentPlatform.COOLIFY:
			return {
				healthCheck: { path: "/health", interval: "30s" },
				gracefulShutdown: { timeout: 15000 },
				logging: { structured: true, level: "info" },
			};

		case DeploymentPlatform.FLY_IO:
			return {
				healthCheck: { path: "/health", interval: "30s" },
				gracefulShutdown: { timeout: 10000 },
				logging: { structured: true, level: "info" },
			};

		case DeploymentPlatform.CLOUDFLARE:
			return {
				maxRequestSize: "100MB",
				timeout: 30000,
				logging: { structured: true, level: "warn" },
			};

		case DeploymentPlatform.GOOGLE_CLOUD_RUN:
			return {
				port: parseInt(process.env.PORT || "8080", 10),
				healthCheck: { path: "/health", timeout: "4s" },
				concurrency: 1000,
				logging: { structured: true, level: "info" },
			};

		case DeploymentPlatform.RAILWAY:
			return {
				port: parseInt(process.env.PORT || "3000", 10),
				healthCheck: { path: "/health", interval: "60s" },
				logging: { structured: true, level: "info" },
			};

		case DeploymentPlatform.RENDER:
			return {
				port: parseInt(process.env.PORT || "10000", 10),
				healthCheck: { path: "/health", interval: "30s" },
				logging: { structured: false, level: "info" },
			};

		case DeploymentPlatform.VERCEL:
			return {
				timeout: 10000, // Vercel has strict timeout limits
				logging: { structured: true, level: "warn" },
			};

		case DeploymentPlatform.NETLIFY:
			return {
				timeout: 10000,
				logging: { structured: true, level: "warn" },
			};

		case DeploymentPlatform.KUBERNETES:
			return {
				healthCheck: { path: "/health", interval: "10s" },
				readinessProbe: { path: "/ready", interval: "5s" },
				gracefulShutdown: { timeout: 30000 },
				logging: { structured: true, level: "info" },
			};

		default:
			return {
				port: parseInt(process.env.PORT || "3000", 10),
				healthCheck: { path: "/health", interval: "30s" },
				logging: { structured: false, level: "info" },
			};
	}
}

/**
 * Logs platform detection information
 * @knipignore
 */
export function logPlatformInfo(result: PlatformDetectionResult): void {
	console.log(`🚀 Platform Detection:`);
	console.log(`   Platform: ${result.platform}`);
	console.log(`   Detected: ${result.detected ? "✅" : "❌"}`);
	console.log(`   Confidence: ${result.confidence}`);

	if (result.info.region) {
		console.log(`   Region: ${result.info.region}`);
	}

	if (result.info.instanceId) {
		console.log(`   Instance ID: ${result.info.instanceId}`);
	}

	if (result.info.appName) {
		console.log(`   App Name: ${result.info.appName}`);
	}

	if (result.info.version) {
		console.log(`   Version: ${result.info.version}`);
	}

	// Log interesting metadata
	const interestingKeys = [
		"environment",
		"deploymentId",
		"gitCommit",
		"gitBranch",
		"serviceType",
	];
	const interestingMetadata = Object.entries(result.info.metadata)
		.filter(
			([key, value]) =>
				interestingKeys.some((k) => key.toLowerCase().includes(k)) && value,
		)
		.slice(0, 3); // Limit to avoid spam

	if (interestingMetadata.length > 0) {
		console.log(`   Metadata:`);
		for (const [key, value] of interestingMetadata) {
			console.log(`     ${key}: ${value}`);
		}
	}
}
