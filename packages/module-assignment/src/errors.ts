import { transformError as sharedTransformError } from "@paideia/shared";

export function transformError(error: unknown) {
	const transformed = sharedTransformError(error);
	if (
		!transformed &&
		(process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
	) {
		console.error("[module-assignment] Unexpected error:", error);
	}
	return transformed;
}
