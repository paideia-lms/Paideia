import { routes } from "virtual:react-router/server-build";
import {
	matchRoutes,
	type Register,
	type ActionFunctionArgs,
	type ClientLoaderFunctionArgs,
	type ClientActionFunctionArgs,
	type LoaderFunctionArgs,
} from "react-router";
import type { AllUnionFields, Simplify } from "type-fest";
import type { GetAnnotations } from "react-router/internal";

export type RouteId = keyof Register["routeModules"];
type RouteModule = Register["routeModules"][RouteId];
export type RouteFile = keyof Register["routeFiles"];
type RoutePage<T extends RouteId> = Simplify<
	Extract<Register["routeFiles"][RouteFile], { id: T }>
>["page"];
export type RouteParams<T extends RouteId> = AllUnionFields<
	Simplify<Register["pages"][RoutePage<T>]["params"]>
>;

/**
 * the matched info
 */
export interface MyRouteInfo {
	id: RouteId;
	parentId?: string;
	path?: string;
	index?: boolean;
	caseSensitive?: boolean;
}

// Function to recursively get all parent routes
function getRouteHierarchy(
	matchedRoute: MyRouteInfo,
	allRoutes: MyRouteInfo[],
): MyRouteInfo[] {
	const hierarchy: MyRouteInfo[] = [matchedRoute];

	if (matchedRoute.parentId) {
		const parentRoute = allRoutes.find(
			(route) => route.id === matchedRoute.parentId,
		);
		if (parentRoute) {
			hierarchy.unshift(...getRouteHierarchy(parentRoute, allRoutes));
		}
	}

	return hierarchy;
}

// Function to get complete route hierarchy for matched routes
function getCompleteRouteHierarchy(
	matchedRoutes: MyRouteInfo[],
	allRoutes: MyRouteInfo[],
): MyRouteInfo[] {
	const completeHierarchy: MyRouteInfo[] = [];

	for (const matchedRoute of matchedRoutes) {
		const hierarchy = getRouteHierarchy(matchedRoute, allRoutes);
		completeHierarchy.push(...hierarchy);
	}

	// Remove duplicates while preserving order
	const uniqueHierarchy = completeHierarchy.filter(
		(route, index, array) =>
			array.findIndex((r) => r.id === route.id) === index,
	);

	return uniqueHierarchy;
}

export function tryGetRouteHierarchy(pathname: string) {
	const matchedRoutes = matchRoutes(
		Object.values(routes).filter(Boolean),
		pathname,
	);
	const allRoutes = Object.values(routes).filter(Boolean);

	if (!matchedRoutes) {
		throw new Error("No matched routes");
	}

	const completeHierarchy = getCompleteRouteHierarchy(
		matchedRoutes.map((r) => r.route as unknown as MyRouteInfo),
		allRoutes as unknown as MyRouteInfo[],
	);
	// console.log('Complete Route Hierarchy:', completeHierarchy);
	return completeHierarchy;
}

type Props = {
	params: unknown;
	loaderData: unknown;
	actionData: unknown;
};
type RouteInfo = Props & {
	module: RouteModule;
	matches: Array<MatchInfo>;
};
type MatchInfo = {
	id: string;
	module: RouteModule;
};

type CreateServerActionArgs<T extends RouteInfo> = GetAnnotations<
	T,
	false
>["ActionArgs"];
type CreateServerLoaderArgs<T extends RouteInfo> = GetAnnotations<
	T,
	false
>["LoaderArgs"];
type CreateClientLoaderArgs<T extends RouteInfo> = GetAnnotations<
	T,
	false
>["ClientLoaderArgs"];
type CreateClientActionArgs<T extends RouteInfo> = GetAnnotations<
	T,
	false
>["ClientActionArgs"];

type InferInfo<
	T extends
		| ActionFunctionArgs
		| ClientLoaderFunctionArgs
		| ClientActionFunctionArgs
		| LoaderFunctionArgs,
> =
	T extends CreateServerActionArgs<infer S>
		? S
		: T extends CreateServerLoaderArgs<infer S>
			? S
			: T extends CreateClientLoaderArgs<infer S>
				? S
				: T extends CreateClientActionArgs<infer S>
					? S
					: never;

export type RouteIdFromRoute<
	T extends
		| ActionFunctionArgs
		| ClientLoaderFunctionArgs
		| ClientActionFunctionArgs
		| LoaderFunctionArgs,
> = InferInfo<T>["matches"] extends [...infer Rest, infer Last]
	? Last extends { id: infer RouteId }
		? RouteId
		: never
	: never;
