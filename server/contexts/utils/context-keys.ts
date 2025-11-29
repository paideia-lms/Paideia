import type { courseContext } from "../course-context";
import type { enrolmentContext } from "../enrolment-context";
import type { courseModuleContext } from "../course-module-context";
import type { courseSectionContext } from "../course-section-context";
import type { userContext } from "../user-context";
import type { globalContext } from "../global-context";
import type { userAccessContext } from "../user-access-context";
import type { userProfileContext } from "../user-profile-context";
import type { userModuleContext } from "../user-module-context";

export const courseContextKey = "courseContext" as typeof courseContext;
export const enrolmentContextKey =
	"enrolmentContext" as typeof enrolmentContext;
export const courseModuleContextKey =
	"courseModuleContext" as typeof courseModuleContext;
export const courseSectionContextKey =
	"courseSectionContext" as typeof courseSectionContext;
export const userContextKey = "userContext" as typeof userContext;
export const globalContextKey = "globalContext" as typeof globalContext;
export const userAccessContextKey =
	"userAccessContext" as typeof userAccessContext;
export const userProfileContextKey =
	"userProfileContext" as typeof userProfileContext;
export const userModuleContextKey =
	"userModuleContext" as typeof userModuleContext;
