import dayjs from "dayjs";
import type {
	CourseScheduleV1,
	RecurringScheduleItem,
	SpecificDateItem,
} from "./schedule-types";
import { courseScheduleV1Schema } from "./schedule-types";

/**
 * Day names for formatting
 */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Formats a time string (HH:mm) to a user-friendly format (h:mm A)
 */
function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const date = new Date();
	date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
	return dayjs(date).format("h:mm A");
}

/**
 * Formats recurring schedule items to a string
 */
function formatRecurringItems(items: RecurringScheduleItem[]): string {
	if (items.length === 0) return "";

	const parts: string[] = [];

	for (const item of items) {
		// Sort days of week
		const sortedDays = [...item.daysOfWeek].sort((a, b) => a - b);
		const dayNames = sortedDays.map((day) => DAY_NAMES[day] ?? "").join(", ");

		const startTime = formatTime(item.startTime);
		const endTime = formatTime(item.endTime);

		let timeRange = `${startTime}-${endTime}`;

		// Add date range if specified
		if (item.startDate || item.endDate) {
			const dateParts: string[] = [];
			if (item.startDate) {
				dateParts.push(`from ${dayjs(item.startDate).format("MMM D, YYYY")}`);
			}
			if (item.endDate) {
				dateParts.push(`until ${dayjs(item.endDate).format("MMM D, YYYY")}`);
			}
			if (dateParts.length > 0) {
				timeRange = `${timeRange} (${dateParts.join(" ")})`;
			}
		}

		parts.push(`${dayNames} ${timeRange}`);
	}

	return parts.join("; ");
}

/**
 * Formats specific date items to a string
 */
function formatSpecificDates(items: SpecificDateItem[]): string {
	if (items.length === 0) return "";

	const parts: string[] = [];

	for (const item of items) {
		const date = dayjs(item.date).format("MMM D, YYYY");
		const startTime = formatTime(item.startTime);
		const endTime = formatTime(item.endTime);

		parts.push(`${date} ${startTime}-${endTime}`);
	}

	return parts.join("; ");
}

/**
 * Type guard to check if a value is a valid course schedule v1
 */
function isCourseScheduleV1(value: unknown): value is CourseScheduleV1 {
	if (typeof value !== "object" || value === null) return false;
	const schedule = value as Record<string, unknown>;

	if (schedule.version !== "v1") return false;

	if (!Array.isArray(schedule.recurring)) return false;
	if (!Array.isArray(schedule.specificDates)) return false;

	// Use Zod schema for validation
	try {
		courseScheduleV1Schema.parse(schedule);
		return true;
	} catch {
		return false;
	}
}

/**
 * Formats a course schedule to a user-friendly string
 *
 * @param schedule - The schedule object (or null/undefined)
 * @returns Formatted schedule string, or empty string if no schedule
 *
 * @example
 * // Recurring: "Mon, Wed 9:00 AM-12:00 PM"
 * // Specific: "Jan 15, 2025 2:00 PM-4:00 PM"
 * // Combined: "Mon, Wed 9:00 AM-12:00 PM; Jan 15, 2025 2:00 PM-4:00 PM"
 */
export function formatCourseSchedule(schedule: unknown): string {
	// Handle null/undefined
	if (!schedule) return "";

	// Validate schedule structure
	if (!isCourseScheduleV1(schedule)) {
		return "";
	}

	const parts: string[] = [];

	// Format recurring patterns
	const recurringStr = formatRecurringItems(schedule.recurring);
	if (recurringStr) {
		parts.push(recurringStr);
	}

	// Format specific dates
	const specificStr = formatSpecificDates(schedule.specificDates);
	if (specificStr) {
		parts.push(specificStr);
	}

	return parts.join("; ");
}
