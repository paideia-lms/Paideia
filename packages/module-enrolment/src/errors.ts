import {
	transformError as sharedTransformError,
} from "@paideia/shared";

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

export function transformError(error: unknown) {
	if (
		process.env.NODE_ENV === "development" ||
		process.env.NODE_ENV === "test"
	) {
		console.error(error);
	}
	if (error instanceof EnrollmentNotFoundError) return error;
	if (error instanceof DuplicateEnrollmentError) return error;
	return sharedTransformError(error);
}
