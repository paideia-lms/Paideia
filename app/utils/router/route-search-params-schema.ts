import type { inferParserType, ParserMap } from "nuqs";
import type { Register } from "react-router";
import type { RouteId } from "app/utils/router/routes-utils";
import type { Simplify } from "type-fest";

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
 * Gets the searchParams type for a given RouteId
 * Uses the RouteId to access the route module and extract searchParams
 */
type SearchParamsForRoute<T extends RouteId> =
	T extends keyof Register["routeModules"]
		? ExtractSearchParams<Register["routeModules"][T]>
		: never;

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
 * Helper type to extract the input type from a ParserMap
 * Makes fields with default values optional
 */
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
