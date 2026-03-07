import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { envVars } from "./env";
import type { Payload } from "payload";

// Initialize S3 client
export const s3Client = new S3Client({
	credentials: {
		accessKeyId: envVars.S3_ACCESS_KEY.value ?? envVars.S3_ACCESS_KEY.default!,
		secretAccessKey: envVars.S3_SECRET_KEY.value ?? envVars.S3_SECRET_KEY.default!,
	},
	endpoint: envVars.S3_ENDPOINT_URL.value ?? envVars.S3_ENDPOINT_URL.default!,
	region: envVars.S3_REGION.value ?? envVars.S3_REGION.default,
	forcePathStyle: true, // Required for S3-compatible storage (VaultS3, MinIO)
});


export async function deleteEverythingInBucket({ logger }: { logger: Payload["logger"] }): Promise<void> {
	try {
		// List all objects in the bucket
		const listCommand = new ListObjectsV2Command({
			Bucket: envVars.S3_BUCKET.value ?? envVars.S3_BUCKET.default!,
		});

		const listResponse = await s3Client.send(listCommand);

		if (!listResponse.Contents || listResponse.Contents.length === 0) {
			logger.info("Bucket is already empty");
			return;
		}

		// Prepare objects for deletion
		const objectsToDelete = listResponse.Contents.map((obj) => ({
			Key: obj.Key!,
		}));

		// Delete all objects
		const deleteCommand = new DeleteObjectsCommand({
			Bucket: envVars.S3_BUCKET.value ?? envVars.S3_BUCKET.default!,
			Delete: {
				Objects: objectsToDelete,
			},
		});

		const deleteResponse = await s3Client.send(deleteCommand);

		logger.info(
			`Successfully deleted ${deleteResponse.Deleted?.length || 0} objects from bucket ${envVars.S3_BUCKET.value ?? envVars.S3_BUCKET.default}`,
		);

		if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
			logger.error(`Some objects failed to delete: ${deleteResponse.Errors.map((error) => error.Key).join(", ")}`);
		}
	} catch (error) {
		logger.error(`Error deleting objects from bucket: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}
