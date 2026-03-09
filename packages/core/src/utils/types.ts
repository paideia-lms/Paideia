export type TryResultValue<T extends (...args: any) => any> = Exclude<
	NonNullable<Awaited<ReturnType<T>>>["value"],
	undefined
>;
