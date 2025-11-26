/**
 * Course Module Settings Schema - Version 2
 *
 * Version 2 adds maxAttempts to assignments and quizzes, and introduces FileSettings.
 * allowLateSubmissions is removed as cutoffDate/closingTime already handle late submission logic.
 */

/**
 * Base settings shared across all module types
 */
interface BaseSettings {
	type: string;
	name?: string; // Course-specific override name for the module
}

/**
 * Settings for page modules
 * Pages currently only need the base settings (optional name override)
 */
export interface PageSettings extends BaseSettings {
	type: "page";
}

/**
 * Settings for whiteboard modules
 * Whiteboards currently only need the base settings (optional name override)
 */
export interface WhiteboardSettings extends BaseSettings {
	type: "whiteboard";
}

/**
 * Settings for assignment modules (v2)
 * Adds maxAttempts, removes allowLateSubmissions (cutoffDate > dueDate implies late submissions)
 */
export interface AssignmentSettingsV2 extends BaseSettings {
	type: "assignment";
	allowSubmissionsFrom?: string; // ISO 8601 date string - when students can start submitting
	dueDate?: string; // ISO 8601 date string - assignment due date
	cutoffDate?: string; // ISO 8601 date string - latest possible submission time
	maxAttempts?: number; // Maximum number of submission attempts allowed
}

/**
 * Settings for quiz modules (v2)
 * Adds maxAttempts, removes allowLateSubmissions (closingTime is strict)
 */
export interface QuizSettingsV2 extends BaseSettings {
	type: "quiz";
	openingTime?: string; // ISO 8601 date string - when quiz becomes available
	closingTime?: string; // ISO 8601 date string - when quiz closes
	maxAttempts?: number; // Maximum number of attempt attempts allowed
}

/**
 * Settings for discussion modules
 */
export interface DiscussionSettings extends BaseSettings {
	type: "discussion";
	dueDate?: string; // ISO 8601 date string - discussion due date
	cutoffDate?: string; // ISO 8601 date string - discussion cutoff date
}

/**
 * Settings for file modules (v2)
 * Files currently only need the base settings (optional name override)
 */
export interface FileSettings extends BaseSettings {
	type: "file";
}

/**
 * Course Module Settings Schema - Version 2
 *
 * Version 2 adds maxAttempts to assignments and quizzes, and introduces FileSettings.
 * allowLateSubmissions is removed as cutoffDate/closingTime already handle late submission logic.
 */
export interface CourseModuleSettingsV2 {
	version: "v2";
	settings:
		| PageSettings
		| WhiteboardSettings
		| AssignmentSettingsV2
		| QuizSettingsV2
		| DiscussionSettings
		| FileSettings;
}
