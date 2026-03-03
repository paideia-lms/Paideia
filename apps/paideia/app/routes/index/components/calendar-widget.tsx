import dayjs from "dayjs";
import {
	Paper,
	Stack,
	Group,
	Text,
	Badge,
	ThemeIcon,
	Title,
} from "@mantine/core";
import { IconCalendar, IconClock } from "@tabler/icons-react";
import { MiniCalendar } from "@mantine/dates";
import { useNuqsSearchParams } from "app/utils/router/search-params-utils";
import { loaderSearchParams } from "../route";

type CalendarWidgetProps = {
	sortedScheduleItems: Array<{
		type: "meeting" | "due";
		data: any;
		startTime: dayjs.Dayjs | undefined;
		endTime: dayjs.Dayjs;
	}>;
	calendarDate?: string;
};

export function CalendarWidget({
	sortedScheduleItems,
	calendarDate,
}: CalendarWidgetProps) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);
	const currentDate = calendarDate || dayjs().format("YYYY-MM-DD");

	const handleDateChange = (value: string | null) => {
		const dateStr = value || dayjs().format("YYYY-MM-DD");
		setQueryParams({ calendarDate: dateStr });
	};

	return (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Stack gap="md">
				<Group>
					<ThemeIcon radius="md" variant="light" color="orange">
						<IconCalendar size={20} />
					</ThemeIcon>
					<Title order={4}>Calendar</Title>
				</Group>
				<MiniCalendar
					value={currentDate}
					onChange={handleDateChange}
					numberOfDays={6}
				/>
				{sortedScheduleItems.length > 0 ? (
					<Stack gap="xs">
						{sortedScheduleItems.map((item) => {
							if (item.type === "meeting") {
								const meeting = item.data;
								return (
									<Paper
										key={`meeting-${meeting.id}`}
										withBorder
										p="sm"
										radius="md"
									>
										<Stack gap={4}>
											<Group justify="space-between">
												<Text size="sm" fw={500} lineClamp={1}>
													{meeting.title}
												</Text>
												<Badge size="xs" color="cyan" variant="light">
													Class
												</Badge>
											</Group>
											<Text size="xs" c="dimmed" fw={500}>
												{meeting.shortcode}
											</Text>
											<Group gap={4}>
												<IconClock
													size={12}
													color="var(--mantine-color-dimmed)"
												/>
												<Text size="xs" c="dimmed">
													{meeting.startTime} - {meeting.endTime}
												</Text>
											</Group>
										</Stack>
									</Paper>
								);
							}

							// Due item
							const dueItem = item.data;
							const badgeColor =
								dueItem.type === "assignment"
									? "blue"
									: dueItem.type === "quiz"
										? "green"
										: "orange";
							return (
								<Paper key={`due-${dueItem.id}`} withBorder p="sm" radius="md">
									<Stack gap={4}>
										<Group justify="space-between">
											<Text size="sm" fw={500} lineClamp={1}>
												{dueItem.title}
											</Text>
											<Badge size="xs" color={badgeColor}>
												{dueItem.type}
											</Badge>
										</Group>
										<Text size="xs" c="dimmed">
											{dueItem.courseTitle}
										</Text>
										<Text size="xs" c="dimmed">
											Due: {dayjs(dueItem.dueDate).format("h:mm A")}
										</Text>
									</Stack>
								</Paper>
							);
						})}
					</Stack>
				) : (
					<Text size="sm" c="dimmed" ta="center" py="md">
						No scheduled items today
					</Text>
				)}
			</Stack>
		</Paper>
	);
}
