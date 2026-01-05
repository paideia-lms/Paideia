import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconClock, IconInfoCircle } from "@tabler/icons-react";
import type { Route } from "../route";

interface ModuleDatesInfoProps {
    settings: Route.ComponentProps["loaderData"]["settings"];
}

// Helper to format dates consistently
const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// Helper to format module settings with date strings
// Only assignment, quiz, and discussion have dates to display
const formatModuleSettingsForDisplay = (
    settings: Route.ComponentProps["loaderData"]["settings"]
) => {
    if (!settings) return null;

    const now = new Date();

    if (settings.type === "assignment") {
        return {
            type: "assignment" as const,
            name: settings.name,
            dates: [
                settings.allowSubmissionsFrom && {
                    label: "Available from",
                    value: formatDateForDisplay(settings.allowSubmissionsFrom),
                    isOverdue: false,
                },
                settings.dueDate && {
                    label: "Due",
                    value: formatDateForDisplay(settings.dueDate),
                    isOverdue: new Date(settings.dueDate) < now,
                },
                settings.cutoffDate && {
                    label: "Final deadline",
                    value: formatDateForDisplay(settings.cutoffDate),
                    isOverdue: new Date(settings.cutoffDate) < now,
                },
            ].filter(Boolean),
        };
    }

    if (settings.type === "quiz") {
        return {
            type: "quiz" as const,
            name: settings.name,
            dates: [
                settings.openingTime && {
                    label: "Opens",
                    value: formatDateForDisplay(settings.openingTime),
                    isOverdue: false,
                },
                settings.closingTime && {
                    label: "Closes",
                    value: formatDateForDisplay(settings.closingTime),
                    isOverdue: new Date(settings.closingTime) < now,
                },
            ].filter(Boolean),
        };
    }

    if (settings.type === "discussion") {
        return {
            type: "discussion" as const,
            name: settings.name,
            dates: [
                settings.dueDate && {
                    label: "Due",
                    value: formatDateForDisplay(settings.dueDate),
                    isOverdue: new Date(settings.dueDate) < now,
                },
                settings.cutoffDate && {
                    label: "Final deadline",
                    value: formatDateForDisplay(settings.cutoffDate),
                    isOverdue: new Date(settings.cutoffDate) < now,
                },
            ].filter(Boolean),
        };
    }

    return null;
};

export function ModuleDatesInfo({ settings }: ModuleDatesInfoProps) {
    const moduleSettings = formatModuleSettingsForDisplay(settings);
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

