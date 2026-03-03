import { S3Client } from "@aws-sdk/client-s3";
import { envVars } from "server/env";

// Initialize S3 client
export const s3Client = new S3Client({
	credentials: {
		accessKeyId: envVars.S3_ACCESS_KEY.value,
		secretAccessKey: envVars.S3_SECRET_KEY.value,
	},
	endpoint: envVars.S3_ENDPOINT_URL.value,
	region: envVars.S3_REGION.value ?? envVars.S3_REGION.default,
	forcePathStyle: true, // Required for MinIO
});
