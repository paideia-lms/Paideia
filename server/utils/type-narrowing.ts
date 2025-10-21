import { z, ZodError } from "zod";
import { DevelopmentError } from "~/utils/error";

function assertZod<T>(
	value: unknown,
	schema: z.ZodSchema<T>,
): asserts value is T {
	// error map 
	schema.parse(value);
}

/** 
 * Add more context to the error message by using the error prefix
 */
export function assertZodInternal<T>(
	errorPrefix: string,
	value: unknown,
	schema: z.ZodSchema<T>,
): asserts value is T {
	try {
		assertZod(value, schema);
	} catch (error) {
		if (error instanceof ZodError) {
			throw new DevelopmentError(`${errorPrefix}: [${z.treeifyError(error).errors.join(", ")}]`)
		}
		throw error
	}
}

// export { assertZod };

export type TryResultValue<T extends (...args: any) => any> = Exclude<
	NonNullable<Awaited<ReturnType<T>>>["value"],
	undefined
>;

export const MOCK_INFINITY = 999999999999999;
