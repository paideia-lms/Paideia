import z from "zod";

function assertZod<T>(
	value: unknown,
	schema: z.ZodSchema<T>,
): asserts value is T {
	schema.parse(value);
}

export { assertZod };

export type TryResultValue<T extends (...args: any) => any> = Exclude<
	NonNullable<Awaited<ReturnType<T>>>["value"],
	undefined
>;

export const MOCK_INFINITY = 999999999999999;
