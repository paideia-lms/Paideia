import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import dayjs from "dayjs";
import { useMemo } from "react";
import { Box } from "@mantine/core";

const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CourseCalendarViewProps {
	recurringSchedules?: Array<{
		daysOfWeek?: Array<{ day?: number }>;
		startTime?: string;
		endTime?: string;
		startDate?: string | Date | null;
		endDate?: string | Date | null;
	}> | null;
	specificDates?: Array<{
		date?: string | Date | null;
		startTime?: string;
		endTime?: string;
	}> | null;
}

export function CourseCalendarView({
	recurringSchedules = null,
	specificDates = null,
}: CourseCalendarViewProps) {
	// Convert schedule data to FullCalendar events
	const calendarEvents: EventInput[] = useMemo(() => {
		const events: EventInput[] = [];

		// Add recurring events (show next 12 months for better visibility)
		const now = dayjs();
		const endDate = now.add(12, "months");

		const recurring =
			recurringSchedules?.map((item) => ({
				daysOfWeek: item.daysOfWeek?.map((d) => d.day ?? 0) ?? [],
				startTime: item.startTime ?? "09:00",
				endTime: item.endTime ?? "12:00",
				startDate: item.startDate
					? typeof item.startDate === "string"
						? item.startDate
						: dayjs(item.startDate).format("YYYY-MM-DD")
					: undefined,
				endDate: item.endDate
					? typeof item.endDate === "string"
						? item.endDate
						: dayjs(item.endDate).format("YYYY-MM-DD")
					: undefined,
			})) ?? [];

		for (const recurringItem of recurring) {
			const startDate = recurringItem.startDate
				? dayjs(recurringItem.startDate)
				: now;
			const recurrenceEnd = recurringItem.endDate
				? dayjs(recurringItem.endDate)
				: endDate;
			const actualEnd = recurrenceEnd.isBefore(endDate)
				? recurrenceEnd
				: endDate;

			for (
				let date = startDate;
				date.isBefore(actualEnd) || date.isSame(actualEnd, "day");
				date = date.add(1, "day")
			) {
				const dayOfWeek = date.day();
				if (recurringItem.daysOfWeek.includes(dayOfWeek)) {
					const dateStr = date.format("YYYY-MM-DD");
					const startDateTime = dayjs(
						`${dateStr}T${recurringItem.startTime}:00`,
					).toDate();
					const endDateTime = dayjs(
						`${dateStr}T${recurringItem.endTime}:00`,
					).toDate();

					events.push({
						title: `${DAY_ABBREVS[dayOfWeek]} ${recurringItem.startTime}-${recurringItem.endTime}`,
						start: startDateTime,
						end: endDateTime,
						allDay: false,
						id: `recurring-${dateStr}-${recurringItem.startTime}`,
					});
				}
			}
		}

		// Add specific dates
		const specific =
			specificDates?.map((item) => ({
				date: item.date ? dayjs(item.date).format("YYYY-MM-DD") : "",
				startTime: item.startTime ?? "09:00",
				endTime: item.endTime ?? "12:00",
			})) ?? [];

		for (const specificItem of specific) {
			if (!specificItem.date) continue;

			const startDateTime = dayjs(
				`${specificItem.date}T${specificItem.startTime}:00`,
			).toDate();
			const endDateTime = dayjs(
				`${specificItem.date}T${specificItem.endTime}:00`,
			).toDate();

			events.push({
				title: `${specificItem.startTime}-${specificItem.endTime}`,
				start: startDateTime,
				end: endDateTime,
				allDay: false,
				id: `specific-${specificItem.date}-${specificItem.startTime}`,
			});
		}

		return events;
	}, [recurringSchedules, specificDates]);

	return (
		<Box>
			<FullCalendar
				plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
				initialView="timeGridWeek"
				headerToolbar={{
					left: "prev,next today",
					center: "title",
					right: "dayGridMonth,timeGridWeek",
				}}
				events={calendarEvents}
				height="auto"
				editable={false}
				selectable={false}
				allDaySlot={false}
				nowIndicator={true}
				slotMinTime="06:00:00"
				slotMaxTime="22:00:00"
			/>
		</Box>
	);
}
