import z from "zod";

function assertZod<T>(
	value: unknown,
	schema: z.ZodSchema<T>,
): asserts value is T {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw z.treeifyError(result.error);
	}
}

export { assertZod };

export type TryResultValue<T extends (...args: any) => any> = Exclude<
	NonNullable<Awaited<ReturnType<T>>>["value"],
	undefined
>;

export const MOCK_INFINITY = 999999999999999;
