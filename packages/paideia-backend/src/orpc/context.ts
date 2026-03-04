import type { S3Client } from "@aws-sdk/client-s3";
import type { Payload } from "payload";

/**
 * Context passed to oRPC procedures. Contains payload for database operations.
 * s3Client is optional; required for media buffer/stream operations.
 * All endpoints are public for now; overrideAccess is used when calling internal functions.
 */
export interface OrpcContext {
	payload: Payload;
	s3Client?: S3Client;
}
