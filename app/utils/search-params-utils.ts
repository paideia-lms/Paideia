import { useQueryStates } from "nuqs";
import type { ParserMap } from "nuqs/server";

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
