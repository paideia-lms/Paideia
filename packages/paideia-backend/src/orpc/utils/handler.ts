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
