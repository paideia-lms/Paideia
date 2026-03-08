import type { Payload, PayloadRequest } from "payload";
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Context passed to oRPC procedures when module-course runs standalone.
 */
export interface OrpcContext {
	payload: Payload;
	s3Client?: S3Client;
	user?: { id: number } | null;
	req?: Partial<PayloadRequest>;
}
