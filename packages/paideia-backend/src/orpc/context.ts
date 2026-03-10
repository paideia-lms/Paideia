import type { S3Client } from "@aws-sdk/client-s3";
import type { Payload, TypedUser } from "payload";

/**
 * Context passed to oRPC procedures. Contains payload for database operations.
 * s3Client is optional; required for media buffer/stream operations.
 * user and req are set by auth middleware when request is authenticated (cookie or API key).
 */
export interface OrpcContext {
	payload: Payload;
	s3Client?: S3Client;
	user?: TypedUser | null;
	req?: { user: TypedUser };
}
