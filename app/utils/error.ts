export class ContextNotFoundError extends Error {
	static readonly type = "ContextNotFoundError";
	get type() {
		return ContextNotFoundError.type;
	}
}

export class UnauthorizedError extends Error {
	static readonly type = "UnauthorizedError";
	get type() {
		return UnauthorizedError.type;
	}
}

export class DuplicateBranchError extends Error {
	static readonly type = "DuplicateBranchError";
	get type() {
		return DuplicateBranchError.type;
	}
}

export class DuplicateActivityModuleError extends Error {
	static readonly type = "DuplicateActivityModuleError";
	get type() {
		return DuplicateActivityModuleError.type;
	}
}

export class InvalidArgumentError extends Error {
	static readonly type = "InvalidArgumentError";
	get type() {
		return InvalidArgumentError.type;
	}
}

export class NonExistingSourceError extends Error {
	static readonly type = "NonExistingSourceError";
	get type() {
		return NonExistingSourceError.type;
	}
}

export class TransactionIdNotFoundError extends Error {
	static readonly type = "TransactionIdNotFoundError";
	get type() {
		return TransactionIdNotFoundError.type;
	}
}

export class NonExistingActivityModuleError extends Error {
	static readonly type = "NonExistingActivityModuleError";
	get type() {
		return NonExistingActivityModuleError.type;
	}
}

export class CommitNoChangeError extends Error {
	static readonly type = "CommitNoChangeError";
	get type() {
		return CommitNoChangeError.type;
	}
}

export class UnknownError extends Error {
	static readonly type = "UnknownError";
	get type() {
		return UnknownError.type;
	}
}

export class EnrollmentNotFoundError extends Error {
	static readonly type = "EnrollmentNotFoundError";
	get type() {
		return EnrollmentNotFoundError.type;
	}
}

export class DuplicateEnrollmentError extends Error {
	static readonly type = "DuplicateEnrollmentError";
	get type() {
		return DuplicateEnrollmentError.type;
	}
}

export class NonExistingMergeRequestError extends Error {
	static readonly type = "NonExistingMergeRequestError";
	get type() {
		return NonExistingMergeRequestError.type;
	}
}

export class NonExistingMediaError extends Error {
	static readonly type = "NonExistingMediaError";
	get type() {
		return NonExistingMediaError.type;
	}
}

export class DevelopmentError extends Error {
	static readonly type = "DevelopmentError";
	get type() {
		return DevelopmentError.type;
	}
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
