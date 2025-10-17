import type { S3Client } from "@aws-sdk/client-s3";
import type { BasePayload } from "payload";
import { createContext } from "react-router";
import type { Storage } from "unstorage";
import type { RouteInfo } from "~/utils/routes-utils";
import type { envVars } from "../env";
import type { Api, Backend } from "../index";
import type { RequestInfo } from "../utils/get-request-info";

export type PageInfo = {
	isAdmin: boolean;
	isMyCourses: boolean;
	isDashboard: boolean;
	isLogin: boolean;
	isCreatingFirstUser: boolean;
	isInCourse: boolean;
	isCourseSettings: boolean;
	isCourseParticipants: boolean;
	isCourseParticipantsLayout: boolean;
	isCourseGroups: boolean;
	isCourseGrades: boolean;
	isCourseModules: boolean;
	isCourseBin: boolean;
	isCourseBackup: boolean;
	isCourseModule: boolean;
	isCourseSection: boolean;
	isUserLayout: boolean;
	isUserOverview: boolean;
	isUserPreference: boolean;
	isUserModules: boolean;
	isUserGrades: boolean;
	isUserNotes: boolean;
	isUserNoteCreate: boolean;
	isUserNoteEdit: boolean;
	isUserModuleNew: boolean;
	isUserModuleEdit: boolean;
};

/**
 * global context for all the routes. it must exist in all the routes.
 * it cannot be null.
 */
export const globalContext = createContext<{
	payload: BasePayload;
	elysia: Backend;
	api: Api;
	requestInfo: RequestInfo;
	s3Client: S3Client;
	unstorage: Storage;
	envVars: typeof envVars;
	routeHierarchy: RouteInfo[];
	pageInfo: PageInfo;
}>();

// ! we can use string as key, please see https://github.com/remix-run/react-router/blob/c1cddedf656271a3eec8368f2854c733b3fe27da/packages/react-router/lib/router/utils.ts#L209
// ! router context provider is just a map
export const globalContextKey =
	"globalContext" as unknown as typeof globalContext;
