import {
	DevelopmentError,
	InvalidArgumentError,
	transformError as sharedTransformError,
	UnknownError,
} from "@paideia/shared";

export { DevelopmentError, InvalidArgumentError, UnknownError };

export function transformError(error: unknown) {
	if (
		process.env.NODE_ENV === "development" ||
		process.env.NODE_ENV === "test"
	) {
		console.error(error);
	}
	return sharedTransformError(error);
}
