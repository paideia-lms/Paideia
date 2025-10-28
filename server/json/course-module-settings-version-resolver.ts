import type {
    CourseModuleSettings,
    CourseModuleSettingsV1,
} from "./course-module-settings.types";

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
    const validTypes = [
        "page",
        "whiteboard",
        "assignment",
        "quiz",
        "discussion",
    ];
    if (typeof settings.type !== "string" || !validTypes.includes(settings.type)) {
        return false;
    }

    return true;
}

/**
 * Resolves course module settings to the latest version
 * Currently v1 is the only version, but this function will handle
 * future migrations as new versions are added.
 *
 * @param config - The configuration object to resolve
 * @returns The resolved configuration in the latest version format
 * @throws Error if the configuration format is invalid
 */
export function tryResolveCourseModuleSettingsToLatest(
    config: unknown,
): CourseModuleSettings {
    // If null or undefined, return null (no settings configured)
    if (config === null || config === undefined) {
        return null as unknown as CourseModuleSettings;
    }

    // V1 is current version, validate and return
    if (isV1Config(config)) {
        return config;
    }

    // Future version migrations would go here
    // Example for future v2:
    // if (isV2Config(config)) {
    //   return config;
    // }
    // if (isV1Config(config)) {
    //   return migrateV1ToV2(config);
    // }

    throw new Error(
        "Invalid course module settings format: unable to resolve to latest version",
    );
}

