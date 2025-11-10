import type { S3Client } from "@aws-sdk/client-s3";
import type { BasePayload } from "payload";
import { createContext } from "react-router";
import type { Storage } from "unstorage";
import type { RouteInfo } from "~/utils/routes-utils";
import type { envVars } from "../env";
import type { Api, Backend } from "../index";
import type { RequestInfo } from "../utils/get-request-info";
import type { PlatformDetectionResult } from "../utils/hosting-platform-detection";

export type PageInfo = {
	isInAdminLayout: boolean;
	isMyCourses: boolean;
	isDashboard: boolean;
	isLogin: boolean;
	isRegistration: boolean;
	isCatalog: boolean;
	isApi: boolean;
	isInCourse: boolean;
	isCourseSettings: boolean;
	isCourseParticipants: boolean;
	isCourseParticipantsProfile: boolean;
	isCourseParticipantsLayout: boolean;
	isCourseGroups: boolean;
	isCourseGrades: boolean;
	isCourseGradesLayout: boolean;
	isCourseModules: boolean;
	isCourseBin: boolean;
	isCourseBackup: boolean;
	isCourseModule: boolean;
	isCourseModuleEdit: boolean;
	isCourseModuleSubmissions: boolean;
	isInCourseModuleLayout: boolean;
	isCourseSection: boolean;
	isCourseSectionNew: boolean;
	isCourseSectionEdit: boolean;
	isInCourseSectionLayout: boolean;
	/**
	 * viewing the public profile page
	 */
	isUserProfile: boolean;
	isUserLayout: boolean;
	isUserOverview: boolean;
	isUserPreference: boolean;
	isUserModules: boolean;
	isUserGrades: boolean;
	isUserNotes: boolean;
	isUserNoteCreate: boolean;
	isUserNoteEdit: boolean;
	isUserMedia: boolean;
	isInUserModulesLayout: boolean;
	isUserModuleNew: boolean;
	isUserModuleEdit: boolean;
	isUserModuleEditSetting: boolean;
	isUserModuleEditAccess: boolean;
	isInUserModuleEditLayout: boolean;
	/**
	 * admin pages
	 */
	isAdminIndex: boolean;
	isAdminUsers: boolean;
	isAdminUserNew: boolean;
	isAdminCourses: boolean;
	isAdminCourseNew: boolean;
	isAdminRegistration: boolean;
	isAdminSystem: boolean;
	isAdminTestEmail: boolean;
	isAdminCategories: boolean;
	isAdminCategoryNew: boolean;
	isAdminMigrations: boolean;
	isAdminDependencies: boolean;
	isAdminCronJobs: boolean;
	isAdminMaintenance: boolean;
	/**
	 * the params of the current route
	 */
	params: Record<string, string>;
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
	platformInfo: PlatformDetectionResult;
	bunVersion: string;
	bunRevision: string;
	hints: { timeZone?: string };
}>();

// ! we can use string as key, please see https://github.com/remix-run/react-router/blob/c1cddedf656271a3eec8368f2854c733b3fe27da/packages/react-router/lib/router/utils.ts#L209
// ! router context provider is just a map
export const globalContextKey =
	"globalContext" as unknown as typeof globalContext;
