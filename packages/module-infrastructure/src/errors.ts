import { transformError as sharedTransformError } from "@paideia/shared";


export class SandboxResetError extends Error {
	static readonly type = "SandboxResetError";
	get type() {
		return SandboxResetError.type;
	}
}

export class EmailSendError extends Error {
	static readonly type = "EmailSendError";
	get type() {
		return EmailSendError.type;
	}
}

/**
 * transformError for infrastructure module - recognizes SandboxResetError and EmailSendError.
 */
export function transformError(error: unknown) {
	if (error instanceof SandboxResetError) return error;
	if (error instanceof EmailSendError) return error;
	return sharedTransformError(error);
}
