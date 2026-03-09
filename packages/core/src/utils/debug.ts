/**
 * Debug logging utility
 * Only logs when NODE_ENV === "development" and DEBUG_LOGS is enabled
 *
 * IMPORTANT: This function is completely disabled in production.
 * Even if DEBUG_LOGS is set in production, it will be ignored.
 */

import { envVars } from "../modules/infrastructure/services/env";

/**
 * Debug log function that only logs in development when DEBUG_LOGS is enabled
 *
 * This function is a no-op in production (NODE_ENV !== "development").
 * The DEBUG_LOGS environment variable is completely ignored in production
 * for security and performance reasons.
 *
 * @param prefix - Prefix for the log message (e.g., function name)
 * @param data - Data to log (optional)
 */
export function debugLog(prefix: string, data?: unknown): void {
	// Early return: completely ignore debug logs in production
	// This check happens first to ensure DEBUG_LOGS is never evaluated in production
	if (process.env.NODE_ENV !== "development") {
		return;
	}

	// Only check DEBUG_LOGS flag in development mode
	if (!envVars.DEBUG_LOGS.enabled) {
		return;
	}

	// Log the debug message
	if (data !== undefined) {
		console.log(`[${prefix}]`, data);
	} else {
		console.log(`[${prefix}]`);
	}
}
