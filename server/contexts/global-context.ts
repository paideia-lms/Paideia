import type { S3Client } from "@aws-sdk/client-s3";
import type { BasePayload, PayloadRequest } from "payload";
import { createContext } from "react-router";
import type { Media } from "server/payload-types";
import type { Storage } from "unstorage";
import type { RouteId, MyRouteInfo } from "~/utils/routes-utils";
import type { TypeSafeRouteParams } from "app/utils/route-params-schema";
import type { envVars } from "../env";
import type { Api, Backend } from "../index";
import type { RequestInfo } from "../utils/get-request-info";
import type { PlatformDetectionResult } from "../utils/hosting-platform-detection";
import type { ParamsType } from "app/utils/route-params-schema";

export type PageInfo = {
	is: Partial<{
		[key in RouteId]: {
			params: TypeSafeRouteParams<key>;
		};
	}>;
	/**
	 * the params of the current route
	 * Use `getParamsForRoute(pageInfo, routeId)` to get type-safe params for a specific route
	 */
	params: Partial<ParamsType>;
};

/**
 * global context for all the routes. it must exist in all the routes.
 * it cannot be null.
 */
export type SystemGlobals = {
	maintenanceSettings: {
		maintenanceMode: boolean;
	};
	sitePolicies: {
		userMediaStorageTotal: number | null;
		siteUploadLimit: number | null;
	};
	appearanceSettings: {
		additionalCssStylesheets: { id: number | string; url: string }[];
		color:
			| "blue"
			| "pink"
			| "indigo"
			| "green"
			| "orange"
			| "gray"
			| "grape"
			| "cyan"
			| "lime"
			| "red"
			| "violet"
			| "teal"
			| "yellow";
		radius: "xs" | "sm" | "md" | "lg" | "xl";
		logoLight?: Media | null;
		logoDark?: Media | null;
		compactLogoLight?: Media | null;
		compactLogoDark?: Media | null;
		faviconLight?: Media | null;
		faviconDark?: Media | null;
	};
	analyticsSettings: {
		additionalJsScripts: Array<{
			src: string;
			defer?: boolean | null;
			async?: boolean | null;
			dataWebsiteId?: string | null;
			dataDomain?: string | null;
			dataSite?: string | null;
			dataMeasurementId?: string | null;
			[key: `data-${string}`]: string | undefined;
		}>;
	};
};

export type GlobalContext = {
	environment: "development" | "production" | "test";
	payload: BasePayload;
	elysia: Backend;
	api: Api;
	requestInfo: RequestInfo;
	s3Client: S3Client;
	unstorage: Storage;
	envVars: typeof envVars;
	routeHierarchy: MyRouteInfo[];
	pageInfo: PageInfo;
	platformInfo: PlatformDetectionResult;
	bunVersion: string;
	bunRevision: string;
	packageVersion: string;
	hints: { timeZone?: string };
	systemGlobals: SystemGlobals;
	payloadRequest: Partial<PayloadRequest>;
};

export const globalContext = createContext<GlobalContext>();

// ! we can use string as key, please see https://github.com/remix-run/react-router/blob/c1cddedf656271a3eec8368f2854c733b3fe27da/packages/react-router/lib/router/utils.ts#L209
// ! router context provider is just a map
export { globalContextKey } from "./utils/context-keys";
