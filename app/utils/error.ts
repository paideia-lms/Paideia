import type { Result } from "typescript-result";

export class ContextNotFoundError extends Error {
	readonly type = "ContextNotFoundError";
}

export class UnauthorizedError extends Error {
	readonly type = "UnauthorizedError";
}

export class DuplicateBranchError extends Error {
	readonly type = "DuplicateBranchError";
}

export class DuplicateActivityModuleError extends Error {
	readonly type = "DuplicateActivityModuleError";
}

export class InvalidArgumentError extends Error {
	readonly type = "InvalidArgumentError";
}

export class NonExistingSourceError extends Error {
	readonly type = "NonExistingSourceError";
}

export class TransactionIdNotFoundError extends Error {
	readonly type = "TransactionIdNotFoundError";
}

export class NonExistingActivityModuleError extends Error {
	readonly type = "NonExistingActivityModuleError";
}

export class UnknownError extends Error {
	readonly type = "UnknownError";
}

export function transformError(error: unknown) {
	if (error instanceof NonExistingSourceError) return error;
	else if (error instanceof DuplicateBranchError) return error;
	else if (error instanceof UnauthorizedError) return error;
	else if (error instanceof ContextNotFoundError) return error;
	// ! we let user handle the unknown error
	else return undefined;
}
