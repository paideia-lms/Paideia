/**
 * Course Schedule Types
 */

export interface RecurringScheduleItem {
	daysOfWeek: number[];
	startTime: string;
	endTime: string;
	startDate?: string;
	endDate?: string;
}

export interface SpecificDateItem {
	date: string;
	startTime: string;
	endTime: string;
}
