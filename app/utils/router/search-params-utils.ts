import { useQueryStates } from "nuqs";
import { stringify } from "qs";
import type { inferParserType, ParserMap } from "nuqs";
import { href, type Register } from "react-router";
import type { Simplify } from "type-fest";
import type { RouteId } from "app/utils/router/routes-utils";

/**
 * Generic hook that wraps useQueryStates to only return setQueryParams
 * with shallow: false always set.
 *
 * @param searchParams - The parser map defining the search parameters
 * @returns The setQueryParams function
 */
export function useNuqsSearchParams<T extends ParserMap>(searchParams: T) {
	const [, setQueryParams] = useQueryStates(searchParams, {
		shallow: false,
	});

	return setQueryParams;
}

type Equal<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
		? true
		: false;

type Pages = Register["pages"];

type Args = {
	[K in keyof Pages]: ToArgs<Pages[K]["params"]>;
};
type ToArgs<Params extends Record<string, string | undefined>> =
	// Check if Params is empty by checking if keyof Params is never
	Equal<keyof Params, never> extends true
		? []
		: Partial<Params> extends Params
			? [Params] | []
			: [Params];

/**
 * Maps a page path to its corresponding RouteId
 * Finds the RouteFile where the page matches
 */
type PageToRouteId<T extends keyof Register["pages"]> = Extract<
	Register["routeFiles"][keyof Register["routeFiles"]],
	{ page: T }
>["id"];

/**
 * Extracts searchParams type from a route module
 * Checks if the module exports searchParams-related exports
 * Priority: loaderSearchParams > searchParams > actionSearchParams
 */
type ExtractSearchParams<Module> = Simplify<
	| (Module extends {
			loaderSearchParams?: infer S extends ParserMap;
	  }
			? LoaderFunctionInput<S>
			: never)
	| (Module extends {
			searchParams?: infer S extends ParserMap;
	  }
			? LoaderFunctionInput<S>
			: never)
	| (Module extends {
			actionSearchParams?: infer S extends ParserMap;
	  }
			? LoaderFunctionInput<S>
			: never)
>;

/** 
 * get the type safe route module by id
 * 
 * @example
 * ```
 * type RouteModule = RouteModuleById<"routes/course.$id">;
 * 
 * type RouteModule = {
  default: ({ loaderData }: Route.ComponentProps) => JSX.Element;
    readonly loaderSearchParams: {
        reload: Omit<SingleParserBuilder<boolean>, "parseServerSide"> & {
            readonly defaultValue: boolean;
            parseServerSide(value: string | string[] | undefined): boolean;
        };
    };
    readonly loader: (args: CreateServerLoaderArgs<Info & {
        module: typeof import("/Users/yomaruhananoshika/repos/@paideia/paideia/app/routes/course.$id");
        matches: Matches;
    }>) => Promise<...>;
}
	```
 */
type RouteModuleById<T extends keyof Register["routeModules"]> = Simplify<
	Register["routeModules"][T]
>;
/**
 * Gets the searchParams type for a given RouteId
 * Uses the RouteId to access the route module and extract searchParams
 */
type SearchParamsForRoute<T extends RouteId> =
	T extends keyof Register["routeModules"]
		? ExtractSearchParams<RouteModuleById<T>>
		: never;

/**
 * Gets the searchParams type for a given page path
 * Uses the RouteId to access the route module and extract searchParams
 */
type SearchParamsForPage<T extends keyof Register["pages"]> =
	PageToRouteId<T> extends keyof Register["routeModules"]
		? ExtractSearchParams<RouteModuleById<PageToRouteId<T>>>
		: unknown;

/**
 * Helper type to check if a type is never
 */
type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Converts route search params to type-safe search params
 * Similar to TypeSafeRouteParams but for search params
 *
 * For example:
 * - If a route exports `loaderSearchParams: { threadId: parseAsInteger }`
 * - Then TypeSafeRouteSearchParams<"routes/course/module.$id"> will be `{ threadId: number | null }`
 */
export type TypeSafeRouteSearchParams<T extends RouteId> =
	IsNever<SearchParamsForRoute<T>> extends true
		? never
		: SearchParamsForRoute<T>;

/**
 * Helper type to check if Args[T] can be an empty tuple (no params required)
 * When Args[T] extends [], it means the route has no required params
 */
type HasNoParams<T extends keyof Register["pages"]> = [] extends Args[T]
	? true
	: false;

/**
 * Gets the params type for a route, making it optional if the route has no required params
 */
type RouteParamsOption<T extends keyof Register["pages"]> =
	HasNoParams<T> extends true
		? { params?: Args[T][number] }
		: { params: Args[T][number] };

/**
 * Makes a property optional if the value of key is null
 *
 * @example
 * type Example = MakeNullOptional<{ a: string | null, b: number | null }>
 * { a?: string | null, b?: number | null }
 */
type MakeNullOptional<T> = {
	[K in keyof T as null extends T[K] ? K : never]?: T[K];
} & {
	[K in keyof T as null extends T[K] ? never : K]: T[K];
};

/**
 * Gets the searchParams type for a route, making it optional if never
 */
type RouteSearchParamsOption<T extends keyof Register["pages"]> =
	IsNever<SearchParamsForPage<T>> extends true
		? { searchParams?: never }
		: {
				searchParams: Simplify<MakeNullOptional<SearchParamsForPage<T>>>;
			};

/**
 * Combined options type that conditionally makes params and searchParams optional
 */
type RouteUrlOptions<T extends keyof Register["pages"]> = Simplify<
	RouteParamsOption<T> & RouteSearchParamsOption<T>
>;

export type LoaderFunctionInput<T extends ParserMap> = Simplify<
	{
		[K in keyof T as T[K] extends { defaultValue: infer _DefaultValue }
			? never
			: K]: inferParserType<T[K]>;
	} & {
		[K in keyof T as T[K] extends { defaultValue: infer _DefaultValue }
			? K
			: never]?: inferParserType<T[K]>;
	}
>;

export function getRouteUrl<T extends keyof Register["pages"]>(
	routeId: T,
	options: RouteUrlOptions<T>,
) {
	// Handle params - if params exists and is not undefined, use it, otherwise use empty array
	const paramsValue =
		"params" in options && options.params !== undefined
			? options.params
			: undefined;
	const url = href(routeId, ...([paramsValue] as any));

	if (
		"searchParams" in options &&
		options.searchParams &&
		Object.keys(options.searchParams).length > 0
	) {
		return (
			url +
			"?" +
			stringify(options.searchParams, {
				// ! skip null to keep URL clean
				skipNulls: true,
			})
		);
	}
	return url;
}
