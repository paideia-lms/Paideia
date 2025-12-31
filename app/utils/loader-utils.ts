import { z } from "zod";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher } from "react-router";
import type { Simplify } from "type-fest";
import { serverOnly$ } from "vite-env-only/macros";
import { badRequest } from "~/utils/responses";
import { paramsSchema, type ParamsType } from "~/utils/params-schema";
import { createLoader, type ParserMap } from "nuqs/server";

type ParamsSchema = typeof paramsSchema;
/**
 * Makes a property optional if the type has no keys, required otherwise.
 * Useful for conditional property requirements based on type emptiness.
 */
type OptionalIfEmpty<T, Key extends string> = keyof T extends never
	? { [K in Key]?: T }
	: { [K in Key]: T };

type PreserveOptionalParams<T extends LoaderFunctionArgs> = {
	params: Simplify<
		{
			[K in Extract<
				keyof T["params"],
				keyof ParamsType
			> as undefined extends T["params"][K] ? K : never]?: ParamsType[K];
		} & {
			[K in Extract<
				keyof T["params"],
				keyof ParamsType
			> as undefined extends T["params"][K] ? never : K]: ParamsType[K];
		}
	>;
};

export function typeCreateLoaderRpc<T extends LoaderFunctionArgs>() {
	return <SearchParamsSchema extends ParserMap | undefined = undefined>({
		searchParams,
	}: {
		searchParams?: SearchParamsSchema;
	} = {}) => {
		const loadSearchParams = searchParams
			? createLoader(searchParams)
			: undefined;

		// Compute SearchParamsType
		type SearchParamsType =
			SearchParamsSchema extends Record<string, unknown>
				? Awaited<ReturnType<NonNullable<typeof loadSearchParams>>>
				: never;

		type Params = PreserveOptionalParams<T>;

		// Base args structure
		type BaseArgs = Omit<T, "params" | "request" | "searchParams"> &
			Params & {
				searchParams: SearchParamsType extends never
					? // biome-ignore lint/complexity/noBannedTypes: it is intented
						{}
					: SearchParamsType;
			};

		// Args with validated params when schema is provided
		type ArgsWithParams = ParamsSchema extends z.ZodTypeAny
			? Simplify<BaseArgs & { params: z.infer<ParamsSchema> }>
			: Simplify<BaseArgs>;

		type OtherSearchParams = SearchParamsType extends never
			? // biome-ignore lint/complexity/noBannedTypes: it is intented
				{}
			: SearchParamsType;

		return <L extends (args: ArgsWithParams) => ReturnType<L>>(
			loader: L,
			options: {
				getRouteUrl: (args: {
					params: Params["params"];
					searchParams?: SearchParamsType extends never
						? // biome-ignore lint/complexity/noBannedTypes: it is intented
							{}
						: Partial<SearchParamsType>;
				}) => string;
			},
		) => {
			const loaderFn = serverOnly$(async (args: T) => {
				const { params, request } = args;

				// check every params in the schema
				for (const [key, value] of Object.entries(params)) {
					const schema = paramsSchema[key as keyof typeof paramsSchema];
					if (schema) {
						const result = schema.safeParse(value);
						if (!result.success) {
							return badRequest({
								success: false,
								error: z.prettifyError(result.error),
							});
						}
					}
				}

				// parse search params if schema is provided
				const parsedSearchParams = loadSearchParams
					? loadSearchParams(request)
					: undefined;

				// Build base args object
				const baseArgs = {
					...args,
					...(parsedSearchParams !== undefined
						? { searchParams: parsedSearchParams }
						: {}),
				} as unknown as BaseArgs;

				let _params: Record<string, string | number | undefined> = {};

				// parse and validate custom params schema if provided
				for (const [key, value] of Object.entries(params)) {
					const parsed =
						paramsSchema[key as keyof typeof paramsSchema].safeParse(value);

					if (!parsed.success) {
						return badRequest({
							success: false,
							error: z.prettifyError(parsed.error),
						});
					}
					_params[key as keyof typeof _params] = parsed.data;
				}

				return loader({
					...baseArgs,
					params: _params,
				});
			})!;

			const hook = () => {
				const fetcher = useFetcher<L>();

				const load = async (
					args: Simplify<
						OptionalIfEmpty<OtherSearchParams, "searchParams"> &
							OptionalIfEmpty<Params["params"], "params">
					>,
				) => {
					const providedSearchParams =
						"searchParams" in args ? args.searchParams : {};
					const providedParams = "params" in args ? args.params : {};
					const url = options.getRouteUrl({
						params: providedParams as Params["params"],
						searchParams: providedSearchParams as SearchParamsType extends never
							? // biome-ignore lint/complexity/noBannedTypes: it is intented
								{}
							: Partial<SearchParamsType>,
					});

					await fetcher.load(url);
				};

				return {
					load,
					isLoading: fetcher.state !== "idle",
					data: fetcher.data,
					fetcher,
				};
			};

			return [loaderFn, hook] as const;
		};
	};
}
