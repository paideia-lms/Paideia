import type { Payload, PayloadRequest } from "payload";
import type { S3Client } from "@aws-sdk/client-s3";

export interface OrpcContext {
	payload: Payload;
	s3Client?: S3Client;
	user?: PayloadRequest["user"];
	req?: Partial<PayloadRequest>;
}
