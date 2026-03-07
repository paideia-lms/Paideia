import { transformError as sharedTransformError } from "@paideia/shared";

export class NonExistingMediaError extends Error {
	static readonly type = "NonExistingMediaError";
	get type() {
		return NonExistingMediaError.type;
	}
}

export class MediaInUseError extends Error {
	static readonly type = "MediaInUseError";
	get type() {
		return MediaInUseError.type;
	}
}

export function transformError(error: unknown) {
	if (
		process.env.NODE_ENV === "development" ||
		process.env.NODE_ENV === "test"
	) {
		console.error(error);
	}
	if (error instanceof NonExistingMediaError) return error;
	if (error instanceof MediaInUseError) return error;
	return sharedTransformError(error);
}
