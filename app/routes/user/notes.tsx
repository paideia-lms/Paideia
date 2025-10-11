import { Heatmap } from "@mantine/charts";
import {
    Badge,
    Box,
    Button,
    Card,
    Container,
    Group,
    Paper,
    SegmentedControl,
    Stack,
    Text,
    Title,
} from "@mantine/core";
import { Calendar } from "@mantine/dates";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import { useState } from "react";
import { Link } from "react-router";
import { Notes } from "server/collections";
import { globalContextKey } from "server/contexts/global-context";
import { tryGenerateNoteHeatmap } from "server/internal/note-management";
import { tryFindUserById } from "server/internal/user-management";
import type { Note } from "server/payload-types";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/notes";

export const loader = async ({
    request,
    context,
    params,
}: Route.LoaderArgs) => {
    const payload = context.get(globalContextKey).payload;
    const { user: currentUser, permissions } = await payload.auth({
        headers: request.headers,
        canSetHeaders: true,
    });

    if (!currentUser) {
        throw new NotFoundResponse("Unauthorized");
    }

    // Get user ID from route params, or use current user
    const userId = params.id ? Number(params.id) : currentUser.id;

    // Fetch the user profile
    const userResult = await tryFindUserById({
        payload,
        userId,
        user: currentUser,
        overrideAccess: false,
    });

    if (!userResult.ok) {
        throw new NotFoundResponse("User not found");
    }

    const profileUser = userResult.value;

    // Fetch notes and generate heatmap data
    const heatmapResult = await tryGenerateNoteHeatmap({
        payload,
        userId,
        user: currentUser,
        overrideAccess: false,
    });

    const { notes, heatmapData, availableYears } = heatmapResult.ok
        ? heatmapResult.value
        : { notes: [], heatmapData: {}, availableYears: [] };

    const canCreateNotes = permissions.collections?.[Notes.slug]?.create === true;

    return {
        user: {
            id: profileUser.id,
            firstName: profileUser.firstName ?? "",
            lastName: profileUser.lastName ?? "",
        },
        isOwnProfile: userId === currentUser.id,
        canCreateNotes,
        notes,
        heatmapData,
        availableYears,
    };
};

export default function NotesPage({ loaderData }: Route.ComponentProps) {
    const {
        user,
        isOwnProfile,
        canCreateNotes,
        notes,
        heatmapData,
        availableYears,
    } = loaderData;
    const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

    const [selectedYear, setSelectedYear] = useState(
        availableYears[0] || new Date().getFullYear(),
    );
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Filter heatmap data for selected year
    const yearHeatmapData = Object.fromEntries(
        Object.entries(heatmapData).filter(([date]) =>
            date.startsWith(String(selectedYear)),
        ),
    );

    // Filter notes based on selected date from calendar
    const filteredNotes = selectedDate
        ? notes.filter((note: Note) => {
            const noteDate = dayjs(note.createdAt).format("YYYY-MM-DD");
            const selectedDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
            return noteDate === selectedDateStr;
        })
        : notes;

    // Highlight dates with notes in calendar
    const getDayProps = (date: string) => {
        const parsedDate = new Date(date);
        const dateStr = dayjs(parsedDate).format("YYYY-MM-DD");
        const hasNotes = (heatmapData[dateStr] || 0) > 0;
        const isSelected =
            selectedDate &&
            dayjs(parsedDate).format("YYYY-MM-DD") ===
            dayjs(selectedDate).format("YYYY-MM-DD");

        return {
            style: {
                backgroundColor: hasNotes
                    ? isSelected
                        ? "var(--mantine-color-blue-filled)"
                        : "var(--mantine-color-blue-light)"
                    : undefined,
                fontWeight: hasNotes ? 700 : undefined,
            },
            onClick: () => setSelectedDate(parsedDate),
        };
    };

    return (
        <Container size="lg" py="xl">
            <title>{`Notes | ${fullName} | Paideia LMS`}</title>
            <meta
                name="description"
                content={`View ${isOwnProfile ? "your" : fullName + "'s"} notes`}
            />
            <meta property="og:title" content={`Notes | ${fullName} | Paideia LMS`} />
            <meta
                property="og:description"
                content={`View ${isOwnProfile ? "your" : fullName + "'s"} notes`}
            />

            <Stack gap="xl">
                <Group justify="space-between" align="center">
                    <Title order={1}>
                        {isOwnProfile ? "My Notes" : `${fullName}'s Notes`}
                    </Title>
                    <Group gap="md">
                        <Text size="sm" c="dimmed">
                            {notes.length} note{notes.length !== 1 ? "s" : ""}
                        </Text>
                        {canCreateNotes && isOwnProfile && (
                            <Button component={Link} to="/user/note/create">
                                Create Note
                            </Button>
                        )}
                    </Group>
                </Group>

                {/* Heatmap Section */}
                <Paper withBorder shadow="md" p="xl" radius="md">
                    <Title order={3} mb="md">
                        Activity Heatmap
                    </Title>

                    {availableYears.length > 1 && (
                        <SegmentedControl
                            value={String(selectedYear)}
                            onChange={(val) => setSelectedYear(Number(val))}
                            data={availableYears.map((y: number) => ({
                                label: String(y),
                                value: String(y),
                            }))}
                            mb="md"
                        />
                    )}

                    <Box>
                        <Heatmap
                            data={yearHeatmapData as Record<string, number>}
                            startDate={`${selectedYear}-01-01`}
                            endDate={`${selectedYear}-12-31`}
                            withTooltip
                            withWeekdayLabels
                            withMonthLabels
                            getTooltipLabel={({ date, value }) =>
                                `${dayjs(date).format("DD MMM, YYYY")} – ${value === null || value === 0
                                    ? "No notes"
                                    : `${value} note${value > 1 ? "s" : ""}`
                                }`
                            }
                        />
                    </Box>
                </Paper>

                {/* Calendar and Notes List */}
                <Group align="flex-start" gap="md" style={{ flexWrap: "wrap" }}>
                    {/* Calendar Section */}
                    <Paper
                        withBorder
                        shadow="md"
                        p="xl"
                        radius="md"
                        style={{ flex: "0 0 auto" }}
                    >
                        <Title order={3} mb="md">
                            Calendar
                        </Title>
                        <Calendar getDayProps={getDayProps} size="md" />
                        {selectedDate && (
                            <Text size="sm" c="dimmed" mt="md" ta="center">
                                {dayjs(selectedDate).format("MMMM D, YYYY")}
                                <br />
                                {filteredNotes.length} note
                                {filteredNotes.length !== 1 ? "s" : ""}
                            </Text>
                        )}
                    </Paper>

                    {/* Notes List */}
                    <Paper
                        withBorder
                        shadow="md"
                        p="xl"
                        radius="md"
                        style={{ flex: "1 1 400px" }}
                    >
                        <Group justify="space-between" mb="md">
                            <Title order={3}>
                                {selectedDate
                                    ? `Notes on ${dayjs(selectedDate).format("MMM DD, YYYY")}`
                                    : "All Notes"}
                            </Title>
                            {selectedDate && (
                                <Text
                                    size="sm"
                                    c="blue"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => setSelectedDate(null)}
                                >
                                    Clear filter
                                </Text>
                            )}
                        </Group>

                        {filteredNotes.length === 0 ? (
                            <Text c="dimmed" ta="center" py="xl">
                                {selectedDate ? "No notes on this date." : "No notes yet."}
                            </Text>
                        ) : (
                            <Stack gap="md">
                                {filteredNotes.map((note: Note) => {
                                    const $ = cheerio.load(note.content);
                                    $("input").attr("disabled", "true");
                                    const html = $.html();
                                    return (
                                        <Card key={note.id} withBorder padding="md" radius="sm">
                                            <Group justify="space-between" mb="xs">
                                                <Text size="xs" c="dimmed">
                                                    {dayjs(note.createdAt).format("MMM DD, YYYY h:mm A")}
                                                </Text>
                                                {note.isPublic && <Badge size="xs">Public</Badge>}
                                            </Group>
                                            {/* change all input to disabled */}
                                            <div
                                                className="tiptap"
                                                /** biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */
                                                dangerouslySetInnerHTML={{ __html: html }}
                                            />
                                        </Card>
                                    );
                                })}
                            </Stack>
                        )}
                    </Paper>
                </Group>
            </Stack>
        </Container>
    );
}
