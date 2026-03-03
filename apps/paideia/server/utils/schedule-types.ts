/**
 * Course Schedule Types
 *
 * Types for course schedules used in backend internal functions.
 */

/**
 * Recurring schedule item - represents a repeating pattern
 * Days of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export interface RecurringScheduleItem {
	daysOfWeek: number[]; // Array of day numbers (0-6)
	startTime: string; // "HH:mm" format (e.g., "09:00")
	endTime: string; // "HH:mm" format (e.g., "12:00")
	startDate?: string; // ISO date string, optional start of recurrence period
	endDate?: string; // ISO date string, optional end of recurrence period
}

/**
 * Specific date schedule item - represents a one-time session
 */
export interface SpecificDateItem {
	date: string; // ISO date string (e.g., "2025-01-15")
	startTime: string; // "HH:mm" format
	endTime: string; // "HH:mm" format
}
