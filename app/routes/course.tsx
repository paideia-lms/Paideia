import {
	Badge,
	Button,
	Card,
	Checkbox,
	Container,
	Grid,
	Group,
	Progress,
	SegmentedControl,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import {
	IconLayoutGrid,
	IconList,
	IconPlus,
	IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import {
	getUserAccessContext,
	userAccessContextKey,
} from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const userAccessContext = context.get(userAccessContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (!userAccessContext) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Extract courses from enrollments
	const courses = userAccessContext.enrollments.map((enrollment) => ({
		id: enrollment.course.id,
		title: enrollment.course.title,
		slug: enrollment.course.slug,
		status: enrollment.course.status,
		description: enrollment.course.description,
		createdAt: enrollment.course.createdAt,
		updatedAt: enrollment.course.updatedAt,
		category: enrollment.course.category?.name,
		enrollmentStatus: enrollment.status,
		completionPercentage: enrollment.status === "completed" ? 100 : 0,
		createdBy: 0, // We don't have this info in the enrollment data
		thumbnailUrl: null, // We don't have this info in the enrollment data
	}));

	// Check if user can manage courses (admin or content-manager)
	const canManageCourses =
		currentUser.role === "admin" || currentUser.role === "content-manager";

	return {
		courses,
		canManageCourses,
		currentUserId: currentUser.id,
	};
};

export default function CoursePage({ loaderData }: Route.ComponentProps) {
	const { courses, canManageCourses, currentUserId } = loaderData;
	const [viewMode, setViewMode] = useState<"card" | "table">("card");
	const [sortBy, setSortBy] = useState<string>("last-accessed");
	const [showCreatedByMe, setShowCreatedByMe] = useState<boolean>(false);
	const navigate = useNavigate();

	const handleCourseClick = (courseId: number) => {
		navigate(href("/course/:id", { id: courseId.toString() }));
	};

	// Filter courses based on "Created by me" filter
	const filteredCourses = showCreatedByMe
		? courses.filter((course) => course.createdBy === currentUserId)
		: courses;

	return (
		<Container size="xl" py="md">
			<title>Course | Paideia LMS</title>
			<meta name="description" content="Course information and content" />
			<meta property="og:title" content="Course | Paideia LMS" />

			<Stack gap="lg">
				{/* Header Section */}
				<Group justify="space-between" align="center">
					<Title order={1}>Course overview</Title>
					{canManageCourses && (
						<Group gap="sm">
							<Button
								variant="outline"
								leftSection={<IconSettings size={16} />}
								component={Link}
								to={href("/admin/courses")}
							>
								Manage courses
							</Button>
							<Button
								leftSection={<IconPlus size={16} />}
								component={Link}
								to={href("/course/new")}
							>
								Create course
							</Button>
						</Group>
					)}
				</Group>

				{/* Controls Section */}
				<Group justify="space-between" align="center">
					<Group gap="md">
						<TextInput placeholder="Search" style={{ width: 200 }} />
						<Select
							placeholder="Sort by last accessed"
							data={[
								{ value: "last-accessed", label: "Sort by last accessed" },
								{ value: "name", label: "Sort by name" },
								{ value: "created-date", label: "Sort by created date" },
							]}
							value={sortBy}
							onChange={(value) => setSortBy(value || "last-accessed")}
							style={{ width: 200 }}
						/>
						<Checkbox
							label="Created by me"
							checked={showCreatedByMe}
							onChange={(event) =>
								setShowCreatedByMe(event.currentTarget.checked)
							}
						/>
					</Group>
					<SegmentedControl
						data={[
							{
								value: "card",
								label: (
									<Group gap="xs" w={64}>
										<IconLayoutGrid size={16} />
										<Text size="sm">Card</Text>
									</Group>
								),
							},
							{
								value: "table",
								label: (
									<Group gap="xs" w={64}>
										<IconList size={16} />
										<Text size="sm">Table</Text>
									</Group>
								),
							},
						]}
						value={viewMode}
						onChange={(value) => setViewMode(value as "card" | "table")}
					/>
				</Group>

				{/* Display Section */}
				{viewMode === "card" ? (
					<Grid>
						{filteredCourses.map((course) => (
							<Grid.Col key={course.id} span={{ base: 12, sm: 6, md: 4 }}>
								<Card
									component={Link}
									to={href("/course/:id", { id: course.id.toString() })}
									shadow="sm"
									padding="lg"
									radius="md"
									withBorder
									style={{ height: "100%", cursor: "pointer" }}
								>
									<Stack gap="sm" style={{ height: "100%" }}>
										{/* Course Thumbnail */}
										<div
											style={{
												height: 120,
												backgroundColor: "#f8f9fa",
												borderRadius: 8,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												backgroundImage: course.thumbnailUrl
													? `url(${course.thumbnailUrl})`
													: undefined,
												backgroundSize: "cover",
												backgroundPosition: "center",
											}}
										>
											{!course.thumbnailUrl && (
												<Text c="dimmed" size="sm">
													No thumbnail
												</Text>
											)}
										</div>

										{/* Course Info */}
										<Stack gap="xs" style={{ flex: 1 }}>
											<Text fw={500} lineClamp={2}>
												{course.title}
											</Text>

											{course.category && (
												<Badge size="sm" variant="light">
													{course.category}
												</Badge>
											)}

											{course.enrollmentStatus && (
												<Badge
													size="sm"
													color={
														course.enrollmentStatus === "active"
															? "green"
															: course.enrollmentStatus === "completed"
																? "blue"
																: course.enrollmentStatus === "dropped"
																	? "red"
																	: "gray"
													}
												>
													{course.enrollmentStatus}
												</Badge>
											)}

											{course.completionPercentage > 0 && (
												<Stack gap="xs">
													<Text size="sm" c="dimmed">
														{course.completionPercentage}% complete
													</Text>
													<Progress
														value={course.completionPercentage}
														size="sm"
														radius="xl"
													/>
												</Stack>
											)}
										</Stack>
									</Stack>
								</Card>
							</Grid.Col>
						))}
					</Grid>
				) : (
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Title</Table.Th>
								<Table.Th>Category</Table.Th>
								<Table.Th>Status</Table.Th>
								<Table.Th>Completion</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{filteredCourses.map((course) => (
								<Table.Tr
									key={course.id}
									style={{ cursor: "pointer" }}
									onClick={() => handleCourseClick(course.id)}
								>
									<Table.Td>
										<Text fw={500}>{course.title}</Text>
									</Table.Td>
									<Table.Td>
										{course.category ? (
											<Badge size="sm" variant="light">
												{course.category}
											</Badge>
										) : (
											<Text c="dimmed">-</Text>
										)}
									</Table.Td>
									<Table.Td>
										{course.enrollmentStatus ? (
											<Badge
												size="sm"
												color={
													course.enrollmentStatus === "active"
														? "green"
														: course.enrollmentStatus === "completed"
															? "blue"
															: course.enrollmentStatus === "dropped"
																? "red"
																: "gray"
												}
											>
												{course.enrollmentStatus}
											</Badge>
										) : (
											<Text c="dimmed">-</Text>
										)}
									</Table.Td>
									<Table.Td>
										{course.completionPercentage > 0 ? (
											<Group gap="xs">
												<Text size="sm">{course.completionPercentage}%</Text>
												<Progress
													value={course.completionPercentage}
													size="sm"
													style={{ width: 60 }}
												/>
											</Group>
										) : (
											<Text c="dimmed">-</Text>
										)}
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}

				{/* Empty State */}
				{filteredCourses.length === 0 && (
					<Stack align="center" gap="md" py="xl">
						<Text size="lg" c="dimmed">
							No courses available
						</Text>
					</Stack>
				)}
			</Stack>
		</Container>
	);
}
