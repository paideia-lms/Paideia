import type { App } from "./index";
import type { BasePayload, } from "payload";
import { createContext } from "react-router";


export const globalContext = createContext<{
    payload: BasePayload
    elysia: App
}>();

// ! we can use string as key, please see https://github.com/remix-run/react-router/blob/c1cddedf656271a3eec8368f2854c733b3fe27da/packages/react-router/lib/router/utils.ts#L209 
// ! router context provider is just a map
export const dbContextKey = "dbContext" as unknown as typeof globalContext;