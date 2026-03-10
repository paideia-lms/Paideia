/**
 * Cleans the S3 bucket in the local testing environment.
 * Deletes all objects in the bucket. Works with VaultS3 and other S3-compatible storage.
 */
import { deleteEverythingInBucket } from "../src/utils/s3-client";

// Only run if this file is executed directly
if (import.meta.main) {
	// @ts-ignore
	await deleteEverythingInBucket({ logger: { 
		info: console.log,
		error: console.error,
		warn: console.warn,
		debug: console.debug,
		trace: console.trace,
		fatal: console.error,
		level: "info",
	} });
}
