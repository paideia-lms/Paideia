/**
 * Course Module Settings Schema - Version 1
 * 
 * This schema defines course-specific settings for activity modules that are linked to courses.
 * Each course module link can have its own settings, allowing the same user module to be
 * added multiple times to a course with different configurations.
 */

export interface CourseModuleSettingsV1 {
    version: "v1";
    settings:
    | PageSettings
    | WhiteboardSettings
    | AssignmentSettings
    | QuizSettings
    | DiscussionSettings;
}

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
 * Settings for assignment modules
 */
export interface AssignmentSettings extends BaseSettings {
    type: "assignment";
    allowSubmissionsFrom?: string; // ISO 8601 date string - when students can start submitting
    dueDate?: string; // ISO 8601 date string - assignment due date
    cutoffDate?: string; // ISO 8601 date string - latest possible submission time
}

/**
 * Settings for quiz modules
 */
export interface QuizSettings extends BaseSettings {
    type: "quiz";
    openingTime?: string; // ISO 8601 date string - when quiz becomes available
    closingTime?: string; // ISO 8601 date string - when quiz closes
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
 * Type alias for the current version of course module settings
 */
export type CourseModuleSettings = CourseModuleSettingsV1;

