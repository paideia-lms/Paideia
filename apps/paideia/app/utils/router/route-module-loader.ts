import type { ParserMap } from "nuqs";
import type { ServerBuild } from "react-router";
import type { RouteId } from "app/utils/router/routes-utils";
import { debugLog } from "@paideia/paideia-backend";

/**
 * Extracts search params parsers from a route module
 * Priority: loaderSearchParams > searchParams > actionSearchParams
 */
function extractSearchParamsParsers(module: unknown): ParserMap | null {
	if (!module || typeof module !== "object") {
		return null;
	}

	const mod = module as Record<string, unknown>;

	// Priority: loaderSearchParams > searchParams > actionSearchParams
	if (
		"loaderSearchParams" in mod &&
		mod.loaderSearchParams &&
		typeof mod.loaderSearchParams === "object"
	) {
		return mod.loaderSearchParams as ParserMap;
	}

	if (
		"searchParams" in mod &&
		mod.searchParams &&
		typeof mod.searchParams === "object"
	) {
		return mod.searchParams as ParserMap;
	}

	if (
		"actionSearchParams" in mod &&
		mod.actionSearchParams &&
		typeof mod.actionSearchParams === "object"
	) {
		return mod.actionSearchParams as ParserMap;
	}

	return null;
}

/**
 * Loads a route module and extracts its search params parsers
 * Always loads directly from route.module without caching
 *
 * @param routeId - The route ID to load
 * @param routes - The routes from ServerBuild
 * @returns The search params parsers or null if not found
 */
export async function tryGetSearchParamsParsers(
	routeId: RouteId,
	routes: ServerBuild["routes"],
): Promise<ParserMap | null> {
	// Get route from routes object
	const route = routes[routeId];
	if (!route) {
		debugLog(`tryGetSearchParamsParsers: route not found for ${routeId}`);
		return null;
	}

	try {
		// Extract search params parsers
		const parsers = extractSearchParamsParsers(route.module);

		if (parsers) {
			debugLog(`tryGetSearchParamsParsers: found parsers for ${routeId}`, {
				keys: Object.keys(parsers),
			});
		} else {
			debugLog(`tryGetSearchParamsParsers: no parsers found for ${routeId}`);
		}

		return parsers;
	} catch (error) {
		debugLog(`tryGetSearchParamsParsers: error loading module for ${routeId}`, {
			error,
		});
		return null;
	}
}
