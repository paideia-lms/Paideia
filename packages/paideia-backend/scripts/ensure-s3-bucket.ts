/**
 * Ensures the S3 bucket exists. Creates it if it does not.
 * Used for CI and local test setup before running tests.
 */
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
	endpoint: process.env.S3_ENDPOINT_URL || "http://localhost:9000",
	region: process.env.S3_REGION || "us-east-1",
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY || "paideia_minio",
		secretAccessKey: process.env.S3_SECRET_KEY || "paideia_minio_secret",
	},
	forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET || "paideia-bucket";

export async function ensureBucket(): Promise<void> {
	try {
		await s3Client.send(
			new HeadBucketCommand({
				Bucket: BUCKET_NAME,
			}),
		);
		console.log(`Bucket ${BUCKET_NAME} already exists`);
		return;
	} catch {
		// Bucket does not exist, create it
	}

	try {
		await s3Client.send(
			new CreateBucketCommand({
				Bucket: BUCKET_NAME,
			}),
		);
		console.log(`Created bucket ${BUCKET_NAME}`);
	} catch (error) {
		const err = error as { name?: string; Code?: string };
		if (
			err.name === "BucketAlreadyOwnedByYou" ||
			err.Code === "BucketAlreadyOwnedByYou" ||
			err.name === "BucketAlreadyExists" ||
			err.Code === "BucketAlreadyExists"
		) {
			console.log(`Bucket ${BUCKET_NAME} already exists`);
			return;
		}
		throw error;
	}
}

if (import.meta.main) {
	await ensureBucket();
}
