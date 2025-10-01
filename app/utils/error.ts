export class ContextNotFoundError extends Error {
	readonly type = "ContextNotFoundError";
}

export class UnauthorizedError extends Error {
	readonly type = "UnauthorizedError";
}

export class DuplicateBranchError extends Error {
	readonly type = "DuplicateBranchError";
}

export class NonExistingSourceError extends Error {
	readonly type = "NonExistingSourceError";
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
