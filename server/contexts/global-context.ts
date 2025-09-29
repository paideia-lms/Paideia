import type { BasePayload } from "payload";
import { createContext } from "react-router";
import type { Api, Backend } from "../index";
import type { RequestInfo } from "../utils/get-request-info";

/**
 * global context for all the routes. it must exist in all the routes.
 * it cannot be null.
 */
export const globalContext = createContext<{
	payload: BasePayload;
	elysia: Backend;
	api: Api;
	requestInfo: RequestInfo;
}>();

// ! we can use string as key, please see https://github.com/remix-run/react-router/blob/c1cddedf656271a3eec8368f2854c733b3fe27da/packages/react-router/lib/router/utils.ts#L209
// ! router context provider is just a map
export const dbContextKey = "dbContext" as unknown as typeof globalContext;
