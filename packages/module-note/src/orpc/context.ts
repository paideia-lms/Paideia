import type { Payload, PayloadRequest } from "payload";
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Context passed to oRPC procedures when module-note runs standalone.
 * When integrated in paideia-backend, use the full OrpcContext from orpc/context.
 */
export interface OrpcContext {
	payload: Payload;
	s3Client?: S3Client;
	user?: { id: number } | null;
	req?: Partial<PayloadRequest>;
}
