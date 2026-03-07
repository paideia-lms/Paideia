/**
 * Test utility error for throwing in tests when result unwrapping fails.
 * Used across module tests (infrastructure, user, etc.).
 */
export class TestError extends Error {
	constructor(message: string, options: { cause?: unknown } = {}) {
		super(message);
		this.name = "TestError";
		this.cause = options.cause;
	}
}

/**
 * Minimal error types used by shared utilities (handle-transaction-id, seed-builder).
 * Consumers (paideia-backend, module-user) may have additional errors.
 */
export class TransactionIdNotFoundError extends Error {
	static readonly type = "TransactionIdNotFoundError";
	get type() {
		return TransactionIdNotFoundError.type;
	}
}

export class UnknownError extends Error {
	static readonly type = "UnknownError";
	get type() {
		return UnknownError.type;
	}
}

export class InvalidArgumentError extends Error {
	static readonly type = "InvalidArgumentError";
	get type() {
		return InvalidArgumentError.type;
	}
}


export class DevelopmentError extends Error {
	static readonly type = "DevelopmentError";
	get type() {
		return DevelopmentError.type;
	}
}

/**
 * Returns the error if it's a known type (avoids double-wrapping).
 * Shared package only recognizes TransactionIdNotFoundError and UnknownError.
 * Consumers with more error types should use their own transformError.
 */
export function transformError(error: unknown) {
	if (error instanceof TestError) return error;
	if (error instanceof TransactionIdNotFoundError) return error;
	if (error instanceof UnknownError) return error;
	if (error instanceof InvalidArgumentError) return error;
	if (error instanceof DevelopmentError) return error;
	return undefined;
}
