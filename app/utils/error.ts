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

export class CommitNoChangeError extends Error {
	readonly type = "CommitNoChangeError";
}

export class UnknownError extends Error {
	readonly type = "UnknownError";
}

export class EnrollmentNotFoundError extends Error {
	readonly type = "EnrollmentNotFoundError";
}

export class DuplicateEnrollmentError extends Error {
	readonly type = "DuplicateEnrollmentError";
}

export class NonExistingMergeRequestError extends Error {
	readonly type = "NonExistingMergeRequestError";
}

export class NonExistingMediaError extends Error {
	readonly type = "NonExistingMediaError";
}

export function transformError(error: unknown) {
	if (process.env.NODE_ENV === "test") {
		console.log("transformError", error);
	}
	if (error instanceof NonExistingSourceError) return error;
	else if (error instanceof DuplicateBranchError) return error;
	else if (error instanceof UnauthorizedError) return error;
	else if (error instanceof ContextNotFoundError) return error;
	else if (error instanceof InvalidArgumentError) return error;
	else if (error instanceof TransactionIdNotFoundError) return error;
	else if (error instanceof NonExistingActivityModuleError) return error;
	else if (error instanceof CommitNoChangeError) return error;
	else if (error instanceof EnrollmentNotFoundError) return error;
	else if (error instanceof DuplicateEnrollmentError) return error;
	else if (error instanceof NonExistingMergeRequestError) return error;
	else if (error instanceof NonExistingMediaError) return error;
	// ! we let user handle the unknown error
	else return undefined;
}
