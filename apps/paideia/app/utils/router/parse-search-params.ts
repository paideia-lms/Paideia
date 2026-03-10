import type { ParserMap } from "nuqs";
import { createLoader } from "nuqs/server";
import type { ServerBuild } from "react-router";
import type { RouteId } from "app/utils/router/routes-utils";
import type { TypeSafeRouteSearchParams } from "app/utils/router/search-params-utils";
import { tryGetSearchParamsParsers } from "app/utils/router/route-module-loader";
import { debugLog } from "@paideia/paideia-backend";

/**
 * Parses search params from URL for a specific route
 * Uses the route's search params parsers to parse the URL query string
 *
 * @param routeId - The route ID to parse search params for
 * @param url - The URL object containing the query string
 * @param routes - The routes from ServerBuild
 * @returns Parsed search params or undefined if route has no search params
 */
export async function parseSearchParamsForRoute<T extends RouteId>(
	routeId: T,
	url: URL,
	routes: ServerBuild["routes"],
): Promise<TypeSafeRouteSearchParams<T> | undefined> {
	const parsers = await tryGetSearchParamsParsers(routeId, routes);

	if (!parsers) {
		debugLog(`parseSearchParamsForRoute: no parsers for ${routeId}`);
		return undefined;
	}

	try {
		// Create a loader function from the parsers
		const loadSearchParams = createLoader(parsers as ParserMap);

		// Create a mock request with the URL
		const request = new Request(url.toString());

		// Parse search params using the loader
		const parsed = loadSearchParams(request);

		debugLog(`parseSearchParamsForRoute: parsed for ${routeId}`, parsed);

		return parsed as TypeSafeRouteSearchParams<T>;
	} catch (error) {
		debugLog(`parseSearchParamsForRoute: error parsing for ${routeId}`, {
			error,
		});
		return undefined;
	}
}
