import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Formats a date in the specified timezone as YYYY-MM-DD.
 * If no timezone is provided, uses dayjs to format in local timezone.
 *
 * @param date - Date string or Date object to format
 * @param tz - Optional timezone string (e.g., "America/Vancouver")
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateInTimeZone(date: string | Date, tz?: string): string {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	if (tz) {
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: tz,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		return formatter.format(dateObj);
	}
	// Otherwise use dayjs which will use local timezone
	return dayjs(dateObj).format("YYYY-MM-DD");
}

/**
 * Formats a date and time for display.
 * Returns a user-friendly date-time string.
 *
 * @param dateString - Date string, Date object, or null/undefined to format
 * @param options - Optional formatting options
 * @param options.timeZone - Optional timezone string (e.g., "America/Vancouver")
 * @param options.includeWeekday - Whether to include weekday (e.g., "Mon, Jan 01, 2025 9:00 AM")
 * @param options.style - Format style: "medium" (default) uses Intl.DateTimeFormat, "dayjs" uses dayjs formatting
 * @returns Formatted date string or "-" if date is null/undefined
 */
export function formatDateTimeForDisplay(
	dateString: string | Date | null | undefined,
	options?: {
		timeZone?: string;
		includeWeekday?: boolean;
		style?: "medium" | "dayjs";
	},
): string {
	if (!dateString) return "-";

	const { timeZone, includeWeekday = false, style = "medium" } = options || {};

	try {
		if (style === "medium") {
			// Use Intl.DateTimeFormat for consistent medium style formatting
			const date =
				typeof dateString === "string" ? new Date(dateString) : dateString;
			return new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				timeStyle: "medium",
				timeZone,
			}).format(date);
		}

		// Use dayjs for custom formatting
		const formatted = timeZone
			? dayjs(dateString).tz(timeZone)
			: dayjs(dateString);

		if (includeWeekday) {
			return formatted.format("ddd, MMM DD, YYYY h:mm A");
		}
		return formatted.format("MMM DD, YYYY h:mm A");
	} catch {
		return typeof dateString === "string" ? dateString : "-";
	}
}

/**
 * Safely parses a date string and extracts local date components.
 * Avoids timezone conversion issues by parsing date strings directly.
 *
 * For ISO strings (e.g., "2025-10-31T00:00:00.000Z"), parses and uses local components.
 * For plain date strings (e.g., "2025-10-31"), parses directly to avoid UTC interpretation.
 *
 * @param dateStr - Date string in ISO format or YYYY-MM-DD format
 * @returns Object with year, month, and day components
 */
export function parseDateString(dateStr: string): {
	year: number;
	month: number;
	day: number;
} {
	// Mantine Calendar provides dates in ISO format or as date strings
	// Parse carefully to avoid timezone conversion issues
	if (dateStr.includes("T")) {
		// ISO string like "2025-10-31T00:00:00.000Z" - parse and use local components
		const date = new Date(dateStr);
		return {
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			day: date.getDate(),
		};
	} else {
		// Date string like "2025-10-31" - parse directly to avoid UTC interpretation
		const [year, month, day] = dateStr.split("-").map(Number);
		return { year: year!, month: month!, day: day! };
	}
}
