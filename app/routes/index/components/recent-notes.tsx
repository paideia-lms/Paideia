import { Paper, Stack, Group, Text, ThemeIcon, Title } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import { Link } from "react-router";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import dayjs from "dayjs";
import { Button } from "@mantine/core";

type RecentNotesSectionProps = {
    recentNotes: { id: number; title: string; createdAt: string; }[];
};

export function RecentNotesSection({ recentNotes }: RecentNotesSectionProps) {
    return <Paper withBorder shadow="sm" p="md" radius="md">
        <Stack gap="md">
            <Group justify="space-between">
                <Group>
                    <ThemeIcon radius="md" variant="light" color="violet">
                        <IconNotes size={20} />
                    </ThemeIcon>
                    <Title order={4}>Recent Notes</Title>
                </Group>
                <Button
                    component={Link}
                    to={getRouteUrl("/user/notes/:id?", { params: { id: undefined }, searchParams: {} })}
                    variant="subtle"
                    size="xs"
                >
                    View All
                </Button>
            </Group>
            {recentNotes.length > 0 ? (
                <Stack gap="xs">
                    {recentNotes.map((note) => (
                        <Paper
                            key={note.id}
                            withBorder
                            p="sm"
                            radius="md"
                            component={Link}
                            to={getRouteUrl("/user/note/edit/:noteId", { params: { noteId: note.id.toString() } })}
                        >
                            <Stack gap={4}>
                                <Text size="sm" fw={500} lineClamp={1}>
                                    {note.title}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    {dayjs(note.createdAt).format("MMM D, YYYY")}
                                </Text>
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            ) : (
                <Text size="sm" c="dimmed" ta="center" py="md">
                    No notes yet
                </Text>
            )}
        </Stack>
    </Paper>;
}
