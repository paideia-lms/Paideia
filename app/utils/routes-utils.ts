import { routes } from "virtual:react-router/server-build";
import { type Register, matchRoutes } from "react-router";

type RouteId = keyof Register['routeModules'];

export interface RouteInfo {
    id: RouteId;
    parentId?: string;
    path?: string;
    index?: boolean;
    caseSensitive?: boolean;
}

// Function to recursively get all parent routes
function getRouteHierarchy(matchedRoute: RouteInfo, allRoutes: RouteInfo[]): RouteInfo[] {
    const hierarchy: RouteInfo[] = [matchedRoute];

    if (matchedRoute.parentId) {
        const parentRoute = allRoutes.find(route => route.id === matchedRoute.parentId);
        if (parentRoute) {
            hierarchy.unshift(...getRouteHierarchy(parentRoute, allRoutes));
        }
    }

    return hierarchy;
}

// Function to get complete route hierarchy for matched routes
function getCompleteRouteHierarchy(matchedRoutes: RouteInfo[], allRoutes: RouteInfo[]): RouteInfo[] {
    const completeHierarchy: RouteInfo[] = [];

    for (const matchedRoute of matchedRoutes) {
        const hierarchy = getRouteHierarchy(matchedRoute, allRoutes);
        completeHierarchy.push(...hierarchy);
    }

    // Remove duplicates while preserving order
    const uniqueHierarchy = completeHierarchy.filter((route, index, array) =>
        array.findIndex(r => r.id === route.id) === index
    );

    return uniqueHierarchy;
}

export function tryGetRouteHierarchy(pathname: string) {
    const matchedRoutes = matchRoutes(Object.values(routes).filter(Boolean), pathname);
    const allRoutes = Object.values(routes).filter(Boolean);

    if (!matchedRoutes) {
        throw new Error("No matched routes");
    }

    const completeHierarchy = getCompleteRouteHierarchy(matchedRoutes.map(r => r.route as unknown as RouteInfo), allRoutes as unknown as RouteInfo[]);
    // console.log('Complete Route Hierarchy:', completeHierarchy);
    return completeHierarchy;
}