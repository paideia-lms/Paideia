/**
 * Cleans the S3 bucket in the local testing environment.
 * Deletes all objects in the bucket. Works with VaultS3 and other S3-compatible storage.
 */
import { deleteEverythingInBucket } from "../src/services/s3-client";


if (import.meta.main) {
	await deleteEverythingInBucket({
		// @ts-ignore
		logger: {
			'info': (message: string) => console.log(message),
			'warn': (message: string) => console.log(message),
			'error': (message: string) => console.log(message),
			'debug': (message: string) => console.log(message),
			'trace': (message: string) => console.log(message),
			'fatal': (message: string) => console.log(message),
			level: 'info',
		}
	});
}
