import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconClock, IconInfoCircle } from "@tabler/icons-react";

export interface ModuleDateInfo {
	label: string;
	value: string;
	isOverdue: boolean;
}

export interface FormattedModuleSettings {
	type: "assignment" | "quiz" | "discussion";
	name: string | undefined;
	dates: ModuleDateInfo[];
}

export interface ModuleDatesInfoProps {
	moduleSettings: FormattedModuleSettings | null;
}

export function ModuleDatesInfo({ moduleSettings }: ModuleDatesInfoProps) {
	if (!moduleSettings || moduleSettings.dates.length === 0) return null;

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Group gap="xs">
					<IconInfoCircle size={20} />
					<Title order={5}>Important Dates</Title>
				</Group>

				<Stack gap="xs">
					{moduleSettings.dates.map((dateInfo) => (
						<Group gap="xs" key={dateInfo.label}>
							{dateInfo.label.includes("Opens") ||
							dateInfo.label.includes("Available") ? (
								<IconCalendar size={16} />
							) : (
								<IconClock size={16} />
							)}
							<Text
								size="sm"
								fw={500}
								c={dateInfo.isOverdue ? "red" : undefined}
							>
								{dateInfo.label}:
							</Text>
							<Text size="sm" c={dateInfo.isOverdue ? "red" : undefined}>
								{dateInfo.value}
								{dateInfo.isOverdue &&
									(dateInfo.label.includes("Closes") ||
									dateInfo.label.includes("deadline")
										? " (Closed)"
										: " (Overdue)")}
							</Text>
						</Group>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}
