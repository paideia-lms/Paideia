export class ContextNotFoundError extends Error {
	readonly type = "ContextNotFoundError";
}

export class UnauthorizedError extends Error {
	readonly type = "UnauthorizedError";
}
