import { z } from "zod";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, href } from "react-router";
import type { Simplify } from "type-fest";
import { serverOnly$ } from "vite-env-only/macros";
import { badRequest, BadRequestResponse } from "~/utils/responses";
import { paramsSchema, type ParamsType } from "app/utils/route-params-schema";
import {
	createLoader,
	type ParserMap,
	type inferParserType,
} from "nuqs/server";
import type { RoutePage, RouteIdFromRouteFunctionArgs } from "./routes-utils";
import { stringify } from "qs";

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

/**
 * The hook automatically derives the URL from the route using href.
 *
 * @example
 * ```ts
 * const createLoaderRpc = typeCreateLoaderRpcV2<Route.LoaderArgs>({
 *   route: "/course/:courseId/grades"
 * });
 *
 * const loaderRpc = createLoaderRpc({
 *   searchParams: { tab: parseAsStringEnum(["report", "setup"]) },
 * });
 *
 * const loader = loaderRpc.createLoader(async ({ searchParams, params }) => {
 *   // loader implementation
 * });
 *
 * const useLoader = loaderRpc.createHook<typeof loader>();
 * ```
 */
export function typeCreateLoaderRpc<T extends LoaderFunctionArgs>({
	route,
}: {
	route: RoutePage<RouteIdFromRouteFunctionArgs<T>>;
}) {
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
				? inferParserType<NonNullable<SearchParamsSchema>>
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

		return {
			createLoader: <L extends (args: ArgsWithParams) => ReturnType<L>>(
				loader: L,
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

					const _params: Record<string, string | number | undefined> = {};

					// parse and validate custom params schema if provided
					for (const [key, value] of Object.entries(params)) {
						const schema = paramsSchema[key as keyof typeof paramsSchema];
						if (schema) {
							const parsed = schema.safeParse(value);

							if (!parsed.success) {
								return badRequest({
									success: false,
									error: z.prettifyError(parsed.error),
								});
							}
							_params[key] = parsed.data;
						} else {
							_params[key] = value;
						}
					}

					return loader({
						...baseArgs,
						params: _params,
					});
				})!;

				return loaderFn;
			},
			createHook: <LoaderType extends (args: any) => any>() => {
				return () => {
					const fetcher = useFetcher<LoaderType>();

					const load = async (
						args: Simplify<
							OptionalIfEmpty<OtherSearchParams, "searchParams"> &
								OptionalIfEmpty<Params["params"], "params">
						>,
					) => {
						const providedSearchParams =
							"searchParams" in args ? args.searchParams : {};
						const providedParams = "params" in args ? args.params : {};

						// Build URL using href with route and params
						const baseUrl = href(
							route as any,
							...(providedParams ? [providedParams] : []),
						);

						// Add search params if any
						const hasSearchParams =
							providedSearchParams &&
							typeof providedSearchParams === "object" &&
							Object.keys(providedSearchParams).length > 0;
						const url = hasSearchParams
							? baseUrl + "?" + stringify(providedSearchParams)
							: baseUrl;

						await fetcher.load(url);
					};

					return {
						load,
						isLoading: fetcher.state !== "idle",
						data: fetcher.data,
						fetcher,
					};
				};
			},
		};
	};
}

export function typeCreateLoader<T extends LoaderFunctionArgs>() {
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
				? inferParserType<NonNullable<SearchParamsSchema>>
				: never;

		type Params = PreserveOptionalParams<T>;

		// Base args structure
		type BaseArgs = Omit<T, "params" | "request" | "searchParams"> &
			Params & {
				searchParams: SearchParamsType extends never
					? // biome-ignore lint/complexity/noBannedTypes: it is intented
						{}
					: SearchParamsType;
			} & {
				request: Omit<T["request"], "method"> & { method: "GET" };
			};

		// Args with validated params when schema is provided
		type ArgsWithParams = ParamsSchema extends z.ZodTypeAny
			? Simplify<BaseArgs & { params: z.infer<ParamsSchema> }>
			: Simplify<BaseArgs>;

		return <L extends (args: ArgsWithParams) => ReturnType<L>>(loader: L) => {
			const loaderFn = serverOnly$(async (args: T) => {
				const { params, request } = args;

				// check every params in the schema
				for (const [key, value] of Object.entries(params)) {
					const schema = paramsSchema[key as keyof typeof paramsSchema];
					if (schema) {
						const result = schema.safeParse(value);
						if (!result.success) {
							throw new BadRequestResponse(
								`Invalid parameter '${key}': ${z.prettifyError(result.error)}`,
							);
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

				const _params: Record<string, string | number | undefined> = {};

				// parse and validate custom params schema if provided
				for (const [key, value] of Object.entries(params)) {
					const schema = paramsSchema[key as keyof typeof paramsSchema];
					if (schema) {
						const parsed = schema.safeParse(value);

						if (!parsed.success) {
							throw new BadRequestResponse(
								`Invalid parameter '${key}': ${z.prettifyError(parsed.error)}`,
							);
						}
						_params[key] = parsed.data;
					} else {
						_params[key] = value;
					}
				}

				return loader({
					...baseArgs,
					params: _params,
				});
			})!;

			return loaderFn;
		};
	};
}
