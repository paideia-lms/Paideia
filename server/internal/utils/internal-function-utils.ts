import type { BasePayload, PayloadRequest, TypedUser } from "payload";

export type BaseInternalFunctionArgs = {
    payload: BasePayload;
    user?: Partial<TypedUser> | null;
    req?: Partial<PayloadRequest>;
    overrideAccess?: boolean;
};