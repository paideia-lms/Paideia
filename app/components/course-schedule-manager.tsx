import {
	Button,
	Checkbox,
	Group,
	Input,
	Modal,
	Paper,
	SegmentedControl,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { MonthPickerInput } from "app/components/month-picker-input";
import { useForm } from "@mantine/form";
import { IconPlus } from "@tabler/icons-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
	EventInput,
	EventClickArg,
	DateSelectArg,
	DateSpanApi,
} from "@fullcalendar/core";
import dayjs from "dayjs";
import {
	useState,
	useEffect,
	useRef,
	forwardRef,
	useImperativeHandle,
	useMemo,
} from "react";
import type {
	RecurringScheduleItem,
	SpecificDateItem,
} from "app/utils/schedule-types";
import {
	useAddRecurringSchedule,
	useAddSpecificDate,
	useRemoveRecurringSchedule,
	useRemoveSpecificDate,
} from "app/routes/course.$id.settings";

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "12:00";

interface CourseScheduleManagerProps {
	courseId: number;
	recurringSchedules?: Array<{
		daysOfWeek?: Array<{ day?: number }>;
		startTime?: string;
		endTime?: string;
		startDate?: string | Date;
		endDate?: string | Date;
	}> | null;
	specificDates?: Array<{
		date?: string | Date;
		startTime?: string;
		endTime?: string;
	}> | null;
}

export function CourseScheduleManager({
	courseId,
	recurringSchedules = null,
	specificDates = null,
}: CourseScheduleManagerProps) {
	const addScheduleModalRef = useRef<AddScheduleModalHandle>(null);
	const calendarRef = useRef<FullCalendar>(null);
	const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
	const { submit: removeRecurring } = useRemoveRecurringSchedule();
	const { submit: removeSpecific } = useRemoveSpecificDate();

	// Sync calendar when selectedMonth changes
	useEffect(() => {
		if (selectedMonth && calendarRef.current) {
			const calendarApi = calendarRef.current.getApi();
			// MonthPicker returns format 'YYYY-MM-DD' (first day of selected month)
			// Use dayjs to parse and convert to Date to avoid timezone issues
			const date = dayjs(selectedMonth).toDate();
			calendarApi.gotoDate(date);
		}
	}, [selectedMonth]);

	// Convert schedule data to FullCalendar events
	// Use useMemo to prevent recalculation on every render
	const calendarEvents: EventInput[] = useMemo(() => {
		const events: EventInput[] = [];

		// Add recurring events (show next 12 months for better visibility)
		const now = dayjs();
		const endDate = now.add(12, "months");

		const recurring =
			recurringSchedules?.map((item) => ({
				daysOfWeek: item.daysOfWeek?.map((d) => d.day ?? 0) ?? [],
				startTime: item.startTime ?? DEFAULT_START_TIME,
				endTime: item.endTime ?? DEFAULT_END_TIME,
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

		for (
			let recurringIndex = 0;
			recurringIndex < recurring.length;
			recurringIndex++
		) {
			const recurringItem = recurring[recurringIndex];
			if (!recurringItem) continue;

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
					// Create Date objects for FullCalendar
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
						extendedProps: {
							type: "recurring",
							index: recurringIndex,
						},
						id: `recurring-${recurringIndex}-${dateStr}`,
					});
				}
			}
		}

		// Add specific dates
		const specific =
			specificDates?.map((item) => ({
				date: item.date ? dayjs(item.date).format("YYYY-MM-DD") : "",
				startTime: item.startTime ?? DEFAULT_START_TIME,
				endTime: item.endTime ?? DEFAULT_END_TIME,
			})) ?? [];

		for (
			let specificIndex = 0;
			specificIndex < specific.length;
			specificIndex++
		) {
			const specificItem = specific[specificIndex];
			if (!specificItem || !specificItem.date) continue;

			// Create Date objects for FullCalendar
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
				extendedProps: {
					type: "specific",
					index: specificIndex,
				},
				id: `specific-${specificIndex}-${specificItem.date}`,
			});
		}

		return events;
	}, [recurringSchedules, specificDates]);

	const normalizeSelection = (selectInfo: DateSelectArg) => {
		const startDate = dayjs(selectInfo.start);
		const isAllDay = selectInfo.allDay === true;
		const endDate = dayjs(selectInfo.end);
		const date = startDate.format("YYYY-MM-DD");

		if (isAllDay) {
			const endInclusive = endDate.subtract(1, "day");
			if (!startDate.isSame(endInclusive, "day")) return null;
			return {
				date,
				startTime: DEFAULT_START_TIME,
				endTime: DEFAULT_END_TIME,
			};
		}

		if (!startDate.isSame(endDate, "day")) return null;

		const startTime = startDate.format("HH:mm");
		const endTime = endDate.format("HH:mm");
		if (endTime <= startTime) return null;

		return {
			date,
			startTime,
			endTime,
		};
	};

	const allowDateSelection = (selectInfo: DateSpanApi) => {
		const startDate = dayjs(selectInfo.start);
		const endDate = dayjs(selectInfo.end);
		if (selectInfo.allDay) {
			const endInclusive = endDate.subtract(1, "day");
			return startDate.isSame(endInclusive, "day");
		}
		return startDate.isSame(endDate, "day") && endDate.isAfter(startDate);
	};

	const handleDateSelect = (selectInfo: DateSelectArg) => {
		const selection = normalizeSelection(selectInfo);
		if (!selection) return;
		addScheduleModalRef.current?.open({
			type: "specific",
			date: selection.date,
			startTime: selection.startTime,
			endTime: selection.endTime,
		});
	};

	const handleEventClick = (clickInfo: EventClickArg) => {
		const { type, index } = clickInfo.event.extendedProps as {
			type: string;
			index: number;
		};
		if (type === "recurring" && typeof index === "number") {
			// Show confirmation and delete recurring schedule
			if (
				confirm(
					"Are you sure you want to delete this recurring schedule pattern?",
				)
			) {
				removeRecurring({
					values: { index },
					params: { courseId },
				});
			}
		} else if (type === "specific" && typeof index === "number") {
			// Show confirmation and delete specific date
			if (confirm("Are you sure you want to delete this specific date?")) {
				removeSpecific({
					values: { index },
					params: { courseId },
				});
			}
		}
	};

	return (
		<Stack gap="lg">
			<Title order={4}>Course Schedule</Title>

			{/* FullCalendar View */}
			<Paper withBorder p="md">
				<Group mb="md" justify="space-between">
					<Button
						leftSection={<IconPlus size={16} />}
						onClick={() => addScheduleModalRef.current?.open()}
					>
						Add Schedule
					</Button>
					<MonthPickerInput
						label="Navigate to month"
						value={selectedMonth}
						onChange={(value: string | null) => {
							setSelectedMonth(value);
						}}
						clearable
					/>
				</Group>
				<FullCalendar
					ref={calendarRef}
					plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
					initialView="dayGridMonth"
					headerToolbar={{
						left: "prev,next today",
						center: "title",
						right: "dayGridMonth,timeGridWeek",
					}}
					views={{
						dayGridMonth: {
							selectable: true,
						},
						timeGridWeek: {
							selectable: true,
						},
					}}
					events={calendarEvents}
					height="auto"
					editable={false}
					select={handleDateSelect}
					selectAllow={allowDateSelection}
					eventClick={handleEventClick}
					allDaySlot={false}
				/>
			</Paper>

			<AddScheduleModal ref={addScheduleModalRef} courseId={courseId} />
		</Stack>
	);
}

export interface AddScheduleModalHandle {
	open: (initialValues?: Partial<ScheduleFormValues>) => void;
}

interface AddScheduleModalProps {
	courseId: number;
}

interface ScheduleFormValues {
	type: "specific" | "recurring";
	date: string | Date | undefined;
	startTime: string;
	endTime: string;
	daysOfWeek: number[];
	startDate: string | Date | undefined;
	endDate: string | Date | undefined;
}

const AddScheduleModal = forwardRef<
	AddScheduleModalHandle,
	AddScheduleModalProps
>(({ courseId }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: addRecurring, isLoading: isLoadingRecurring } =
		useAddRecurringSchedule();
	const { submit: addSpecific, isLoading: isLoadingSpecific } =
		useAddSpecificDate();

	const isLoading = isLoadingRecurring || isLoadingSpecific;

	const form = useForm<ScheduleFormValues>({
		initialValues: {
			type: "specific",
			date: dayjs().format("YYYY-MM-DD"),
			startTime: "09:00",
			endTime: "12:00",
			daysOfWeek: [],
			startDate: undefined,
			endDate: undefined,
		},
		validate: {
			date: (value, values) => {
				if (values.type === "specific") {
					if (!value) return "Date is required";
					// Check if value is a string before regex test, or if it is a Date object
					const dateStr =
						typeof value === "string"
							? value
							: dayjs(value).format("YYYY-MM-DD");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
						return "Date must be in YYYY-MM-DD format";
					}
				}
				return null;
			},
			daysOfWeek: (value, values) => {
				if (values.type === "recurring" && value.length === 0) {
					return "Select at least one day";
				}
				return null;
			},
			startTime: (value) => {
				if (!value) return "Start time is required";
				if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
					return "Time must be in HH:mm format";
				}
				return null;
			},
			endTime: (value, values) => {
				if (!value) return "End time is required";
				if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
					return "Time must be in HH:mm format";
				}
				if (values.startTime && value <= values.startTime) {
					return "End time must be later than start time";
				}
				return null;
			},
		},
	});

	useImperativeHandle(ref, () => ({
		open: (initialValues) => {
			form.reset();
			if (initialValues) {
				form.setValues({
					...form.values,
					...initialValues,
				});
			}
			setOpened(true);
		},
	}));

	const toggleDay = (day: number) => {
		const current = form.values.daysOfWeek;
		if (current.includes(day)) {
			form.setFieldValue(
				"daysOfWeek",
				current.filter((d) => d !== day),
			);
		} else {
			form.setFieldValue(
				"daysOfWeek",
				[...current, day].sort((a, b) => a - b),
			);
		}
	};

	const handleSubmit = form.onSubmit(async (values) => {
		if (values.type === "recurring") {
			const recurringData: RecurringScheduleItem = {
				daysOfWeek: values.daysOfWeek,
				startTime: values.startTime,
				endTime: values.endTime,
				startDate: values.startDate
					? dayjs(values.startDate).format("YYYY-MM-DD")
					: undefined,
				endDate: values.endDate
					? dayjs(values.endDate).format("YYYY-MM-DD")
					: undefined,
			};
			await addRecurring({
				values: { data: recurringData },
				params: { courseId },
			});
		} else {
			const specificData: SpecificDateItem = {
				date:
					typeof values.date === "string"
						? values.date
						: dayjs(values.date).format("YYYY-MM-DD"),
				startTime: values.startTime,
				endTime: values.endTime,
			};
			await addSpecific({
				values: { data: specificData },
				params: { courseId },
			});
		}
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			onExitTransitionEnd={() => form.reset()}
			title="Add Schedule"
			size="lg"
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<SegmentedControl
						fullWidth
						data={[
							{ label: "Specific Date", value: "specific" },
							{ label: "Recurring Schedule", value: "recurring" },
						]}
						{...form.getInputProps("type")}
					/>

					{form.values.type === "recurring" ? (
						<>
							<Input.Wrapper label="Days of Week" required withAsterisk>
								<Group gap="xs" mt="xs">
									{DAY_NAMES.map((_, index) => (
										<Checkbox
											key={`day-${index}-${DAY_ABBREVS[index]}`}
											label={DAY_ABBREVS[index]}
											checked={form.values.daysOfWeek.includes(index)}
											onChange={() => toggleDay(index)}
										/>
									))}
								</Group>
								{form.errors.daysOfWeek && (
									<div
										style={{
											color: "var(--mantine-color-error)",
											fontSize: "var(--mantine-font-size-xs)",
											marginTop: "calc(var(--mantine-spacing-xs) / 2)",
										}}
									>
										{form.errors.daysOfWeek}
									</div>
								)}
							</Input.Wrapper>

							<Group grow>
								<DateInput
									{...form.getInputProps("startDate")}
									label="Start Date range (optional)"
									value={
										form.values.startDate
											? new Date(form.values.startDate)
											: null
									}
									onChange={(date) =>
										form.setFieldValue(
											"startDate",
											date ? dayjs(date).format("YYYY-MM-DD") : undefined,
										)
									}
									clearable
								/>
								<DateInput
									{...form.getInputProps("endDate")}
									label="End Date range (optional)"
									value={
										form.values.endDate ? new Date(form.values.endDate) : null
									}
									onChange={(date) =>
										form.setFieldValue(
											"endDate",
											date ? dayjs(date).format("YYYY-MM-DD") : undefined,
										)
									}
									clearable
								/>
							</Group>
						</>
					) : (
						<DateInput
							{...form.getInputProps("date")}
							label="Date"
							value={form.values.date ? new Date(form.values.date) : null}
							onChange={(date) =>
								form.setFieldValue(
									"date",
									date ? dayjs(date).format("YYYY-MM-DD") : "",
								)
							}
							required
							withAsterisk
						/>
					)}

					<Group grow>
						<TextInput
							{...form.getInputProps("startTime")}
							label="Start Time"
							type="time"
							required
							withAsterisk
						/>
						<TextInput
							{...form.getInputProps("endTime")}
							label="End Time"
							type="time"
							required
							withAsterisk
						/>
					</Group>

					<Group justify="flex-end">
						<Button
							variant="subtle"
							onClick={() => setOpened(false)}
							disabled={isLoading}
							type="button"
						>
							Cancel
						</Button>
						<Button type="submit" loading={isLoading}>
							Add
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
});

AddScheduleModal.displayName = "AddScheduleModal";
