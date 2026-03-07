import type { Payload, PayloadRequest } from "payload";

/**
 * Context passed to oRPC procedures when module-infrastructure runs standalone.
 * When integrated in paideia-backend, use the full OrpcContext from orpc/context.
 */
export interface OrpcContext {
	payload: Payload;
	req?: Partial<PayloadRequest>;
}
