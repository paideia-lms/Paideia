/**
 * Course Schedule Types and Schemas
 *
 * Types and Zod schemas for course schedules, supporting both recurring patterns
 * (e.g., "Every Monday and Wednesday, 9:00 AM - 12:00 PM") and specific dates
 * (e.g., "January 15, 2025, 2:00 PM - 4:00 PM").
 */

import { z } from "zod";

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

/**
 * Course schedule structure (v1)
 */
export interface CourseScheduleV1 {
	version: "v1";
	recurring: RecurringScheduleItem[];
	specificDates: SpecificDateItem[];
}

/**
 * Zod schema for RecurringScheduleItem
 */
export const recurringScheduleItemSchema = z.object({
	daysOfWeek: z
		.array(z.number().int().min(0).max(6))
		.min(1, "At least one day of week must be selected"),
	startTime: z
		.string()
		.regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format"),
	endTime: z
		.string()
		.regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format"),
	startDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
		.optional(),
	endDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
		.optional(),
});

/**
 * Zod schema for SpecificDateItem
 */
export const specificDateItemSchema = z.object({
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
	startTime: z
		.string()
		.regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format"),
	endTime: z
		.string()
		.regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format"),
});

/**
 * Zod schema for CourseScheduleV1
 */
export const courseScheduleV1Schema = z.object({
	version: z.literal("v1"),
	recurring: z.array(recurringScheduleItemSchema),
	specificDates: z.array(specificDateItemSchema),
});

/**
 * Zod schema for CourseScheduleV1 that allows null (for optional schedule fields)
 */
export const courseScheduleV1SchemaNullable = courseScheduleV1Schema.nullable();
