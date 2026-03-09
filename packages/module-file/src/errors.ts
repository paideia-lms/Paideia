import {
	transformError as sharedTransformError,
} from "@paideia/shared";

export function transformError(error: unknown) {
	if (
		process.env.NODE_ENV === "development" ||
		process.env.NODE_ENV === "test"
	) {
		console.error(error);
	}
	return sharedTransformError(error);
}
