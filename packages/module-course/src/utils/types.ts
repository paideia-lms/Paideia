export type TryResultValue<T extends (...args: any) => any> = Exclude<
	Awaited<ReturnType<T>>,
	{ ok: false }
> extends infer R
	? R extends { value: infer V }
		? V
		: never
	: never;
