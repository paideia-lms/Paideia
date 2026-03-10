import type { Payload } from "payload";
import { ORPCError } from "@orpc/server";

type ResultLike = Promise<{ ok: boolean; value?: unknown; error?: { message: string } }>;

export async function handleResult<T>(fn: () => ResultLike): Promise<T> {
	const result = await fn();
	if (!result.ok) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: result.error?.message ?? "Unknown error",
		});
	}
	return result.value as T;
}

type ResultLikeT<T> = Promise<{ ok: boolean; value?: T; error?: { message: string } }>;

/**
 * Runs an internal try* function with merged args (adds req, overrideAccess).
 * Uses any for fn parameter to accept any internal function signature.
 */
export function run<T>(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fn: (args: any) => ResultLikeT<T>,
	args: Record<string, unknown>,
): Promise<T> {
	return handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));
}

export function wrapHandler<TArgs extends object>(
	fn: (args: object) => ResultLike,
	base: { payload: Payload },
	input: TArgs,
) {
	return handleResult(() =>
		fn({
			...base,
			...input,
			req: undefined,
			overrideAccess: true,
		}),
	);
}
