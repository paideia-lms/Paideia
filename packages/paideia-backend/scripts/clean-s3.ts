/**
 * Cleans the S3 bucket in the local testing environment.
 * Deletes all objects in the bucket. Works with VaultS3 and other S3-compatible storage.
 */
import { deleteEverythingInBucket } from "../src/utils/s3-client";

const logger = {
	info: console.log,
	error: console.error,
};

// Only run if this file is executed directly
if (import.meta.main) {
	await deleteEverythingInBucket({ logger });
}
