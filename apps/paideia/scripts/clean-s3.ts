/**
 * this script is used to clean the s3 bucket in the local testing environment.
 * use it when you want to clean the s3 bucket in the local environment
 * it will delete all objects in the bucket
 */
import {
	DeleteObjectsCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
	endpoint: process.env.S3_ENDPOINT_URL || "http://localhost:9000",
	region: "us-east-1",
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY || "paideia_minio",
		secretAccessKey: process.env.S3_SECRET_KEY || "paideia_minio_secret",
	},
	forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET || "paideia-bucket";

export async function deleteEverythingInBucket(): Promise<void> {
	try {
		// List all objects in the bucket
		const listCommand = new ListObjectsV2Command({
			Bucket: BUCKET_NAME,
		});

		const listResponse = await s3Client.send(listCommand);

		if (!listResponse.Contents || listResponse.Contents.length === 0) {
			console.log("Bucket is already empty");
			return;
		}

		// Prepare objects for deletion
		const objectsToDelete = listResponse.Contents.map((obj) => ({
			Key: obj.Key!,
		}));

		// Delete all objects
		const deleteCommand = new DeleteObjectsCommand({
			Bucket: BUCKET_NAME,
			Delete: {
				Objects: objectsToDelete,
			},
		});

		const deleteResponse = await s3Client.send(deleteCommand);

		console.log(
			`Successfully deleted ${deleteResponse.Deleted?.length || 0} objects from bucket ${BUCKET_NAME}`,
		);

		if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
			console.error("Some objects failed to delete:", deleteResponse.Errors);
		}
	} catch (error) {
		console.error("Error deleting objects from bucket:", error);
		throw error;
	}
}

// Only run if this file is executed directly
if (import.meta.main) {
	await deleteEverythingInBucket();
}
