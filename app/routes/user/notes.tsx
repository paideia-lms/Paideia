import { Heatmap } from "@mantine/charts";
import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Group,
	Indicator,
	Paper,
	SegmentedControl,
	Stack,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import { Calendar } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import { useQueryState } from "nuqs";
import { createLoader, parseAsString } from "nuqs/server";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userAccessContextKey } from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import {
	convertUserAccessContextToUserProfileContext,
	getUserProfileContext,
	type UserProfileContext,
} from "server/contexts/user-profile-context";
import { tryDeleteNote } from "server/internal/note-management";
import type { Note } from "server/payload-types";
import { RichTextRenderer } from "~/components/rich-text-renderer";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { formatDateInTimeZone, parseDateString } from "~/utils/date-utils";
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/notes";

// Define search params for date selection
export const notesSearchParams = {
	date: parseAsString,
};

export const loadSearchParams = createLoader(notesSearchParams);

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const { payload, hints } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { id } = params;

	// Get client hints for timezone
	const timeZone = hints.timeZone;

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Get user ID from route params, or use current user
	const userId = id ? Number(id) : currentUser.id;

	// Get user profile context
	let userProfileContext: UserProfileContext | null = null;
	if (userId === currentUser.id) {
		// If viewing own profile, use userAccessContext if available
		const userAccessContext = context.get(userAccessContextKey);
		if (userAccessContext) {
			userProfileContext = convertUserAccessContextToUserProfileContext(
				userAccessContext,
				currentUser,
			);
		} else {
			// Fallback to fetching directly
			userProfileContext = await getUserProfileContext(
				payload,
				userId,
				currentUser,
			);
		}
	} else {
		// Viewing another user's profile
		userProfileContext = await getUserProfileContext(
			payload,
			userId,
			currentUser,
		);
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User not found");
	}

	// user can create notes if he is the user of this profile
	const canCreateNotes = userId === currentUser.id;

	// Get selected date from search params
	const { date: dateParam } = loadSearchParams(request);

	// Filter notes by date if date parameter is provided
	let filteredNotes = userProfileContext.notes;
	if (dateParam) {
		// The dateParam is a date string like "2025-10-31" which represents a date in the client's timezone
		// We should use it directly for comparison without parsing and converting
		const selectedDateStr = dateParam; // Already in YYYY-MM-DD format

		// Filter notes by matching the date in client's timezone
		filteredNotes = userProfileContext.notes.filter((note: Note) => {
			const noteDate = formatDateInTimeZone(note.createdAt, timeZone);
			return noteDate === selectedDateStr;
		});
	}

	return {
		user: userProfileContext.profileUser,
		isOwnProfile: userId === currentUser.id,
		canCreateNotes,
		currentUserId: currentUser.id,
		currentUserRole: currentUser.role,
		notes: userProfileContext.notes,
		filteredNotes,
		heatmapData: userProfileContext.heatmapData,
		availableYears: userProfileContext.availableYears,
		timeZone: timeZone,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "DELETE");

	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

	const formData = await request.formData();
	const noteId = Number(formData.get("noteId"));

	if (Number.isNaN(noteId)) {
		return badRequest({ error: "Invalid note ID" });
	}

	const result = await tryDeleteNote({
		payload,
		noteId,
		user: {
			...currentUser,
			collection: "users",
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return ok({ message: "Note deleted successfully" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Note deleted",
			message: "Your note has been deleted successfully",
			color: "green",
		});
	} else {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}

	return actionData;
}

// HeatmapSection component
function HeatmapSection({
	selectedYear,
	setSelectedYear,
	availableYears,
	yearHeatmapData,
}: {
	selectedYear: number;
	setSelectedYear: (year: number) => void;
	availableYears: number[];
	yearHeatmapData: Record<string, number>;
}) {
	const [_, setSelectedDate] = useQueryState(
		"date",
		parseAsString.withOptions({
			shallow: false,
		}),
	);
	return (
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
					data={yearHeatmapData}
					startDate={`${selectedYear}-01-01`}
					endDate={`${selectedYear}-12-31`}
					withTooltip
					withWeekdayLabels
					withMonthLabels
					getTooltipLabel={({ date, value }) =>
						`${dayjs(date).format("DD MMM, YYYY")} – ${
							value === null || value === 0
								? "No notes"
								: `${value} note${value > 1 ? "s" : ""}`
						}`
					}
					rectSize={16}
					rectRadius={3}
					gap={3}
					domain={[0, 10]}
					getRectProps={({ date, value }) => ({
						onClick: () => setSelectedDate(date),
					})}
				/>
			</Box>
		</Paper>
	);
}

// CalendarSection component
function CalendarSection({
	selectedDate,
	setDateParam,
	filteredNotes,
	getDayProps,
	clientHeatmapData,
	timeZone,
}: {
	selectedDate: Date | null;
	setDateParam: (date: string | null) => void;
	filteredNotes: Note[];
	getDayProps: (date: string) => {
		style: {
			backgroundColor?: string;
			fontWeight?: number;
		};
		onClick: () => void;
	};
	clientHeatmapData: Record<string, number>;
	timeZone?: string;
}) {
	return (
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
			<Calendar
				getDayProps={getDayProps}
				size="md"
				renderDay={(date: string) => {
					// Parse the date string safely to avoid timezone issues
					const { year, month, day } = parseDateString(date);
					const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
					const noteCount = clientHeatmapData[dateStr] || 0;

					// Create a Date object in local timezone for formatting the tooltip
					const localDate = new Date(year, month - 1, day);

					return (
						<Tooltip
							label={
								noteCount > 0
									? `${noteCount} note${noteCount > 1 ? "s" : ""} on ${dayjs(localDate).format("MMM D, YYYY")}`
									: `No notes on ${dayjs(localDate).format("MMM D, YYYY")}`
							}
							withArrow
						>
							<div
								style={{
									width: "100%",
									height: "100%",
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
								}}
							>
								<Indicator
									size={6}
									color="blue"
									offset={-2}
									disabled={noteCount === 0}
								>
									<div>{day}</div>
								</Indicator>
							</div>
						</Tooltip>
					);
				}}
			/>
			{selectedDate && (
				<Text size="sm" c="dimmed" mt="md" ta="center">
					{dayjs(selectedDate).format("MMMM D, YYYY")}
					<br />
					{filteredNotes.length} note
					{filteredNotes.length !== 1 ? "s" : ""}
				</Text>
			)}
			{selectedDate && (
				<Text
					size="xs"
					c="blue"
					ta="center"
					mt="xs"
					style={{ cursor: "pointer" }}
					onClick={() => setDateParam(null)}
				>
					Clear filter
				</Text>
			)}
		</Paper>
	);
}

// NotesSection component
function NotesSection({
	selectedDate,
	setDateParam,
	filteredNotes,
	currentUserId,
	currentUserRole,
	handleDeleteNote,
}: {
	selectedDate: Date | null;
	setDateParam: (date: string | null) => void;
	filteredNotes: Note[];
	currentUserId: number;
	currentUserRole: string;
	handleDeleteNote: (noteId: number) => void;
}) {
	return (
		<Paper
			withBorder
			shadow="md"
			p="xl"
			radius="md"
			style={{ flex: "1 1 400px", maxWidth: "100%", overflow: "hidden" }}
		>
			<Group justify="space-between" mb="md">
				<Title order={3}>
					{selectedDate
						? `${filteredNotes.length} Notes on ${dayjs(selectedDate).format("MMM DD, YYYY")}`
						: "All Notes"}
				</Title>
				{selectedDate && (
					<Text
						size="sm"
						c="blue"
						style={{ cursor: "pointer" }}
						onClick={() => setDateParam(null)}
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

						// Check if current user can edit/delete this note
						const createdById =
							typeof note.createdBy === "object"
								? note.createdBy.id
								: note.createdBy;
						const canEdit =
							currentUserId === createdById || currentUserRole === "admin";

						return (
							<Card
								key={note.id}
								withBorder
								padding="md"
								radius="sm"
								style={{
									overflow: "hidden",
									maxWidth: "100%",
								}}
							>
								<Group justify="space-between" mb="xs">
									<Group gap="xs">
										<Text size="xs" c="dimmed">
											{dayjs(note.createdAt).format("MMM DD, YYYY h:mm A")}
										</Text>
										{note.isPublic && <Badge size="xs">Public</Badge>}
									</Group>
									{canEdit && (
										<Group gap="xs">
											<ActionIcon
												component={Link}
												to={`/user/note/edit/${note.id}`}
												variant="subtle"
												color="blue"
												size="sm"
												aria-label="Edit note"
											>
												<IconEdit size={16} />
											</ActionIcon>
											<ActionIcon
												onClick={() => handleDeleteNote(note.id)}
												variant="subtle"
												color="red"
												size="sm"
												aria-label="Delete note"
											>
												<IconTrash size={16} />
											</ActionIcon>
										</Group>
									)}
								</Group>
								{/* change all input to disabled */}
								<RichTextRenderer content={html} />
							</Card>
						);
					})}
				</Stack>
			)}
		</Paper>
	);
}

export default function NotesPage({ loaderData }: Route.ComponentProps) {
	const {
		user,
		isOwnProfile,
		canCreateNotes,
		currentUserId,
		currentUserRole,
		notes,
		filteredNotes: initialFilteredNotes,
		heatmapData,
		availableYears,
		timeZone,
	} = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const fetcher = useFetcher<typeof clientAction>();

	const [selectedYear, setSelectedYear] = useState(
		availableYears[0] || new Date().getFullYear(),
	);

	// Use query state for selected date (shallow: false to trigger navigation)
	const [dateParam, setDateParam] = useQueryState(
		"date",
		parseAsString.withOptions({
			shallow: false,
		}),
	);

	// Convert date param to Date object for calendar
	const selectedDate = dateParam
		? dayjs(dateParam, "YYYY-MM-DD").toDate()
		: null;

	const handleDeleteNote = (noteId: number) => {
		if (
			!window.confirm(
				"Are you sure you want to delete this note? This action cannot be undone.",
			)
		) {
			return;
		}

		const formData = new FormData();
		formData.append("noteId", String(noteId));
		fetcher.submit(formData, { method: "DELETE" });
	};

	// Regenerate heatmap data mapping using client timezone
	// Server-generated heatmap data uses server timezone, so we need to remap it
	const clientHeatmapData: Record<string, number> = {};
	notes.forEach((note: Note) => {
		const dateKey = formatDateInTimeZone(note.createdAt, timeZone);
		clientHeatmapData[dateKey] = (clientHeatmapData[dateKey] || 0) + 1;
	});

	// Filter heatmap data for selected year using client timezone
	const yearHeatmapData = Object.fromEntries(
		Object.entries(clientHeatmapData).filter(([date]) =>
			date.startsWith(String(selectedYear)),
		),
	);

	// Use filtered notes from loader if date is selected, otherwise use all notes
	const filteredNotes = dateParam ? initialFilteredNotes : notes;

	// Highlight dates with notes in calendar
	const getDayProps = (date: string) => {
		const { year, month, day } = parseDateString(date);
		const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

		const hasNotes = (clientHeatmapData[dateStr] || 0) > 0;
		const isSelected = selectedDate && dateParam === dateStr;

		return {
			style: {
				backgroundColor: hasNotes
					? isSelected
						? "var(--mantine-color-blue-filled)"
						: "var(--mantine-color-blue-light)"
					: undefined,
				fontWeight: hasNotes ? 700 : undefined,
			},
			onClick: () => {
				// Set the date parameter using the parsed date string
				setDateParam(dateStr);
			},
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

				<HeatmapSection
					selectedYear={selectedYear}
					setSelectedYear={setSelectedYear}
					availableYears={availableYears}
					yearHeatmapData={yearHeatmapData}
				/>

				{/* Calendar and Notes List */}
				<Group align="flex-start" gap="md" style={{ flexWrap: "wrap" }}>
					<CalendarSection
						selectedDate={selectedDate}
						setDateParam={setDateParam}
						filteredNotes={filteredNotes}
						getDayProps={getDayProps}
						clientHeatmapData={clientHeatmapData}
						timeZone={timeZone}
					/>

					<NotesSection
						selectedDate={selectedDate}
						setDateParam={setDateParam}
						filteredNotes={filteredNotes}
						currentUserId={currentUserId}
						currentUserRole={currentUserRole || "student"}
						handleDeleteNote={handleDeleteNote}
					/>
				</Group>
			</Stack>
		</Container>
	);
}
