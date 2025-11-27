import {
	type LatestCourseModuleSettings,
	tryResolveCourseModuleSettingsToLatest,
} from "./course-module-settings/version-resolver";
import {
	type LatestQuizConfig,
	tryResolveQuizConfigToLatest,
} from "./raw-quiz-config/version-resolver";

export {
	type LatestCourseModuleSettings,
	tryResolveCourseModuleSettingsToLatest,
	type LatestQuizConfig,
	tryResolveQuizConfigToLatest,
};

export type LatestQuizSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "quiz" }
>;
export type LatestAssignmentSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "assignment" }
>;
export type LatestDiscussionSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "discussion" }
>;
export type LatestPageSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "page" }
>;
export type LatestWhiteboardSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "whiteboard" }
>;
export type LatestFileSettings = Extract<
	LatestCourseModuleSettings["settings"],
	{ type: "file" }
>;
