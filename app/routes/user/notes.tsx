import { Heatmap } from "@mantine/charts";
import {
	ActionIcon,
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
import { notifications } from "@mantine/notifications";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
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
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/notes";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const { id } = params;

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

	return {
		user: userProfileContext.profileUser,
		isOwnProfile: userId === currentUser.id,
		canCreateNotes,
		currentUserId: currentUser.id,
		currentUserRole: currentUser.role,
		notes: userProfileContext.notes,
		heatmapData: userProfileContext.heatmapData,
		availableYears: userProfileContext.availableYears,
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

export default function NotesPage({ loaderData }: Route.ComponentProps) {
	const {
		user,
		isOwnProfile,
		canCreateNotes,
		currentUserId,
		currentUserRole,
		notes,
		heatmapData,
		availableYears,
	} = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const fetcher = useFetcher<typeof clientAction>();

	const [selectedYear, setSelectedYear] = useState(
		availableYears[0] || new Date().getFullYear(),
	);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
								`${dayjs(date).format("DD MMM, YYYY")} – ${
									value === null || value === 0
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
						style={{ flex: "1 1 400px", maxWidth: "100%", overflow: "hidden" }}
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

									// Check if current user can edit/delete this note
									const createdById =
										typeof note.createdBy === "object"
											? note.createdBy.id
											: note.createdBy;
									const canEdit =
										currentUserId === createdById ||
										currentUserRole === "admin";

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
														{dayjs(note.createdAt).format(
															"MMM DD, YYYY h:mm A",
														)}
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
				</Group>
			</Stack>
		</Container>
	);
}
