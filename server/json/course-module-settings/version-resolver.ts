import type {
	AssignmentSettings as AssignmentSettingsV1,
	CourseModuleSettingsV1,
	QuizSettings as QuizSettingsV1,
} from "./v1";
import type {
	AssignmentSettingsV2,
	CourseModuleSettingsV2,
	QuizSettingsV2,
} from "./v2";

/**
 * Type alias for the current version of course module settings
 */
export type LatestCourseModuleSettings = CourseModuleSettingsV2;
type ExtractSettings<T extends { type: string }> = Extract<
	LatestCourseModuleSettings["settings"],
	T
>;
export type LatestCourseQuizSettings = ExtractSettings<{ type: "quiz" }>;
export type LatestCourseAssignmentSettings = ExtractSettings<{
	type: "assignment";
}>;
export type LatestCourseDiscussionSettings = ExtractSettings<{
	type: "discussion";
}>;
export type LatestCoursePageSettings = ExtractSettings<{ type: "page" }>;
export type LatestCourseWhiteboardSettings = ExtractSettings<{
	type: "whiteboard";
}>;
export type LatestCourseFileSettings = ExtractSettings<{ type: "file" }>;

/**
 * Type guard to check if a config is a valid v1 settings object
 */
function isV1Config(config: unknown): config is CourseModuleSettingsV1 {
	if (typeof config !== "object" || config === null) {
		return false;
	}

	const obj = config as Record<string, unknown>;

	// Must have version "v1"
	if (obj.version !== "v1") {
		return false;
	}

	// Must have settings object
	if (typeof obj.settings !== "object" || obj.settings === null) {
		return false;
	}

	const settings = obj.settings as Record<string, unknown>;

	// Must have a valid type
	const validTypes = ["page", "whiteboard", "assignment", "quiz", "discussion"];
	if (
		typeof settings.type !== "string" ||
		!validTypes.includes(settings.type)
	) {
		return false;
	}

	return true;
}

/**
 * Type guard to check if a config is a valid v2 settings object
 */
function isV2Config(config: unknown): config is CourseModuleSettingsV2 {
	if (typeof config !== "object" || config === null) {
		return false;
	}

	const obj = config as Record<string, unknown>;

	// Must have version "v2"
	if (obj.version !== "v2") {
		return false;
	}

	// Must have settings object
	if (typeof obj.settings !== "object" || obj.settings === null) {
		return false;
	}

	const settings = obj.settings as Record<string, unknown>;

	// Must have a valid type
	const validTypes = [
		"page",
		"whiteboard",
		"assignment",
		"quiz",
		"discussion",
		"file",
	];
	if (
		typeof settings.type !== "string" ||
		!validTypes.includes(settings.type)
	) {
		return false;
	}

	return true;
}

/**
 * Migrates v1 settings to v2 format
 */
function migrateV1ToV2(config: CourseModuleSettingsV1): CourseModuleSettingsV2 {
	const { settings } = config;

	// For assignment settings, preserve all fields and add maxAttempts (undefined)
	if (settings.type === "assignment") {
		const assignmentSettings = settings as AssignmentSettingsV1;
		const v2Settings: AssignmentSettingsV2 = {
			...assignmentSettings,
			maxAttempts: undefined,
		};
		return {
			version: "v2",
			settings: v2Settings,
		};
	}

	// For quiz settings, preserve all fields and add maxAttempts (undefined)
	if (settings.type === "quiz") {
		const quizSettings = settings as QuizSettingsV1;
		const v2Settings: QuizSettingsV2 = {
			...quizSettings,
			maxAttempts: undefined,
		};
		return {
			version: "v2",
			settings: v2Settings,
		};
	}

	// For other types, pass through unchanged
	return {
		version: "v2",
		settings: settings as CourseModuleSettingsV2["settings"],
	};
}

/**
 * Resolves course module settings to the latest version
 * Automatically migrates v1 settings to v2 when accessed.
 *
 * @param config - The configuration object to resolve
 * @returns The resolved configuration in the latest version format
 * @throws Error if the configuration format is invalid
 */
export function tryResolveCourseModuleSettingsToLatest(
	config: unknown,
): LatestCourseModuleSettings {
	// If null or undefined, return null (no settings configured)
	if (config === null || config === undefined) {
		return null as unknown as LatestCourseModuleSettings;
	}

	// V2 is current version, validate and return
	if (isV2Config(config)) {
		return config;
	}

	// Migrate v1 to v2
	if (isV1Config(config)) {
		return migrateV1ToV2(config);
	}

	throw new Error(
		"Invalid course module settings format: unable to resolve to latest version",
	);
}
