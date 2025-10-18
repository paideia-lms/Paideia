/**
 * this file stored helper reapsonse type for react router
 */
import { data } from "react-router";

type ResponseInitWithoutStatus = Omit<ResponseInit, "status">;

export const StatusCode = {
	// 200 is the default status code
	Ok: 200 as const,
	// indicates that the HTTP request has led to the creation of a resource
	Created: 201 as const,
	// indicates that the request has been accepted for processing, but the processing has not been completed
	Accepted: 202 as const,
	BadRequest: 400 as const,
	Unauthorized: 401 as const,
	Forbidden: 403 as const,
	Redirect: 302 as const,
	NotFound: 404 as const,
	InternalServerError: 500 as const,
};

export function ok<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.Ok },
		{ ...init, status: StatusCode.Ok },
	);
}

export function created<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.Created },
		{ ...init, status: StatusCode.Created },
	);
}

export class BadRequestResponse extends Response {
	constructor(message: string) {
		super(message, {
			status: StatusCode.BadRequest,
			statusText: "Bad Request",
		});
	}
}

export function badRequest<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.BadRequest },
		{ ...init, status: StatusCode.BadRequest },
	);
}

export class UnauthorizedResponse extends Response {
	constructor(message: string) {
		super(message, {
			status: StatusCode.Unauthorized,
			statusText: "Unauthorized",
		});
	}
}

export function unauthorized<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.Unauthorized },
		{ ...init, status: StatusCode.Unauthorized },
	);
}

export class ForbiddenResponse extends Response {
	constructor(message: string) {
		super(message, {
			status: StatusCode.Forbidden,
			statusText: "Forbidden",
		});
	}
}

export function forbidden<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.Forbidden },
		{ ...init, status: StatusCode.Forbidden },
	);
}

export function notFound<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.NotFound },
		{ ...init, status: StatusCode.NotFound },
	);
}

export class NotFoundResponse extends Response {
	constructor(message: string) {
		super(message, { status: StatusCode.NotFound, statusText: "Not Found" });
	}
}


export function internalServerError<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.InternalServerError },
		{ ...init, status: StatusCode.InternalServerError },
	);
}

export class InternalServerErrorResponse extends Response {
	constructor(message: string) {
		super(message, { status: StatusCode.InternalServerError, statusText: "Internal Server Error" });
	}
}