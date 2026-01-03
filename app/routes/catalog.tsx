import {
	Badge,
	Box,
	Card,
	Container,
	Group,
	Pagination,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import {
	IconBook,
	IconCalendar,
	IconClock,
	IconMapPin,
	IconUser,
	IconUsers,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { parseAsString } from "nuqs/server";
import { useState } from "react";
import { href, redirect } from "react-router";
import { typeCreateLoader } from "app/utils/loader-utils";
import { userContextKey } from "server/contexts/user-context";
import type { Route } from "./+types/catalog";

export function getRouteUrl() {
	return href("/catalog");
}

// Define search params
export const catalogSearchParams = {
	code: parseAsString.withDefault(""),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: catalogSearchParams,
})(async ({ context, searchParams }) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return redirect(href("/login"));
	}

	// Get course code from query params
	const { code } = searchParams;

	// If no code, redirect to dashboard
	if (!code) {
		return redirect(href("/"));
	}

	// Convert URL format back to normal (e.g., "COMP-460" -> "COMP 460")
	const courseCode = code.replace(/-/g, " ");

	// Mock course data - in real implementation, this would come from database
	const mockCourseInfo = {
		code: courseCode,
		title: getCourseTitle(courseCode),
		description: getCourseDescription(courseCode),
		credits: 3,
		prerequisites: getPrerequisites(courseCode),
	};

	// Mock course instances grouped by semester
	const mockCourseInstances = getMockCourseInstances(courseCode);

	return {
		courseInfo: mockCourseInfo,
		courseInstances: mockCourseInstances,
		searchParams,
	};
});

// Helper functions to generate mock data
function getCourseTitle(code: string): string {
	const titles: Record<string, string> = {
		"COMP 101": "Intro to Computer Science",
		"COMP 110": "Programming Fundamentals",
		"COMP 210": "Data Structures",
		"COMP 310": "Algorithms",
		"COMP 320": "Database Systems",
		"COMP 330": "Operating Systems",
		"COMP 340": "Software Engineering",
		"COMP 350": "Computer Networks",
		"COMP 410": "Information Security",
		"COMP 420": "Machine Learning",
		"COMP 430": "Cloud Computing",
		"COMP 450": "Cybersecurity",
		"COMP 460": "Deep Learning",
		"COMP 470": "Distributed Systems",
		"MATH 140": "Mathematics for CS",
		"MATH 250": "Discrete Mathematics",
		"STAT 260": "Statistics for Business",
	};
	return titles[code] || "Course Title";
}

function getCourseDescription(code: string): string {
	return `This is a comprehensive course covering the fundamental concepts and advanced topics in ${getCourseTitle(code)}. Students will engage in hands-on projects, collaborative learning, and real-world problem solving.`;
}

function getPrerequisites(code: string): string[] {
	const prereqs: Record<string, string[]> = {
		"COMP 210": ["COMP 110"],
		"COMP 310": ["COMP 210"],
		"COMP 320": ["COMP 210"],
		"COMP 330": ["COMP 210"],
		"COMP 340": ["COMP 310"],
		"COMP 350": ["COMP 330"],
		"COMP 460": ["COMP 420"],
		"MATH 250": ["MATH 140"],
	};
	return prereqs[code] || [];
}

function getMockCourseInstances(code: string) {
	// Generate semesters from 2023 to future (2026)
	const semesters = generateSemesters();

	const instructors = [
		"Dr. Sarah Johnson",
		"Prof. Michael Chen",
		"Dr. Emily Rodriguez",
		"Prof. David Kim",
		"Dr. Amanda Williams",
	];

	const schedules = [
		{ days: "MWF", time: "9:00 AM - 10:00 AM" },
		{ days: "MWF", time: "10:00 AM - 11:00 AM" },
		{ days: "MWF", time: "2:00 PM - 3:00 PM" },
		{ days: "TTh", time: "10:00 AM - 11:30 AM" },
		{ days: "TTh", time: "2:00 PM - 3:30 PM" },
		{ days: "TTh", time: "4:00 PM - 5:30 PM" },
	];

	const locations = [
		"Science Building 101",
		"Engineering Hall 205",
		"Computer Lab A",
		"Tech Center 301",
		"Innovation Hub 102",
	];

	return semesters.map((semester, semesterIndex) => {
		// Get current date to determine semester status
		const currentDate = dayjs();
		const semesterDate = getSemesterDate(semester.term, semester.year);
		const isPast = semesterDate.isBefore(currentDate, "month");
		const isCurrent =
			semesterDate.isSame(currentDate, "month") ||
			(semesterDate.isBefore(currentDate) &&
				semesterDate.add(4, "month").isAfter(currentDate));

		// Generate 2-3 sections per semester
		const numSections = semesterIndex % 3 === 0 ? 2 : 3;
		const sections = [];

		for (let i = 0; i < numSections; i++) {
			const sectionLetter = String.fromCharCode(65 + i); // A, B, C
			const schedule = schedules[i % schedules.length]!;
			const instructor = instructors[i % instructors.length];
			const location = locations[i % locations.length];

			// Vary enrollment based on section and semester status
			const capacity = 30 + i * 5;
			const enrolled = isPast
				? capacity // Past semesters: full
				: isCurrent
					? Math.floor(capacity * 0.85) // Current semester: mostly full
					: Math.floor(capacity * 0.2); // Future semesters: less enrolled

			// Determine status
			let status: "completed" | "in progress" | "open" | "future";
			if (isPast) {
				status = "completed";
			} else if (isCurrent) {
				status = "in progress";
			} else {
				status =
					semesterDate.diff(currentDate, "month") < 6 ? "open" : "future";
			}

			sections.push({
				section: sectionLetter,
				shortcode: `${code} ${sectionLetter} ${semester.term} ${semester.year}`,
				instructor,
				days: schedule.days,
				time: schedule.time,
				location,
				enrolled,
				capacity,
				status,
			});
		}

		return {
			semester: semester.label,
			sections,
		};
	});
}

// Helper function to generate semesters from 2023 to 2026
function generateSemesters() {
	const currentDate = dayjs();
	const startYear = 2023;
	const endYear = currentDate.year() + 2; // Go 2 years into future
	const semesters = [];

	for (let year = startYear; year <= endYear; year++) {
		// Spring semester (Jan-May)
		semesters.push({ term: "SP", year, label: `SP ${year}` });
		// Summer semester (Jun-Aug)
		semesters.push({ term: "SU", year, label: `SU ${year}` });
		// Fall semester (Sep-Dec)
		semesters.push({ term: "FA", year, label: `FA ${year}` });
	}

	return semesters;
}

// Helper function to get approximate start date for a semester
function getSemesterDate(term: string, year: number) {
	if (term === "SP") {
		return dayjs(`${year}-01-15`);
	}
	if (term === "SU") {
		return dayjs(`${year}-06-01`);
	}
	// FA
	return dayjs(`${year}-09-01`);
}

export default function CatalogPage({ loaderData }: Route.ComponentProps) {
	const { courseInfo, courseInstances } = loaderData;

	// Pagination state - show 4 semesters per page
	const [activePage, setActivePage] = useState(1);
	const semestersPerPage = 4;
	const totalPages = Math.ceil(courseInstances.length / semestersPerPage);

	// Get current page's semesters (reverse order so most recent is first)
	const startIndex = (activePage - 1) * semestersPerPage;
	const endIndex = startIndex + semestersPerPage;
	const reversedInstances = [...courseInstances].reverse();
	const paginatedInstances = reversedInstances.slice(startIndex, endIndex);

	const title = `${courseInfo.code} - Course Catalog | Paideia LMS`;
	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`${courseInfo.code}: ${courseInfo.title} - Course catalog and sections`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`${courseInfo.code}: ${courseInfo.title} - Course catalog and sections`}
			/>
			<Stack gap="xl">
				{/* Course Header */}
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Stack gap="md">
						<Group>
							<Box
								style={{
									width: 60,
									height: 60,
									borderRadius: 8,
									backgroundColor: "var(--mantine-color-blue-1)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<IconBook size={32} color="var(--mantine-color-blue-6)" />
							</Box>
							<Stack gap={4}>
								<Text size="sm" c="dimmed" fw={600}>
									{courseInfo.code}
								</Text>
								<Title order={2}>{courseInfo.title}</Title>
							</Stack>
						</Group>

						<Text c="dimmed">{courseInfo.description}</Text>

						<Group gap="xl">
							<Group gap="xs">
								<Text size="sm" fw={600}>
									Credits:
								</Text>
								<Badge size="lg" variant="light">
									{courseInfo.credits}
								</Badge>
							</Group>
							{courseInfo.prerequisites.length > 0 && (
								<Group gap="xs">
									<Text size="sm" fw={600}>
										Prerequisites:
									</Text>
									<Group gap="xs">
										{courseInfo.prerequisites.map((prereq) => (
											<Badge key={prereq} size="sm" variant="outline">
												{prereq}
											</Badge>
										))}
									</Group>
								</Group>
							)}
						</Group>
					</Stack>
				</Paper>

				{/* Course Instances by Semester */}
				<Stack gap="xl">
					<Group justify="space-between" align="center">
						<Title order={3}>Available Sections</Title>
						<Text size="sm" c="dimmed">
							Showing semesters from 2023 to {dayjs().year() + 2}
						</Text>
					</Group>

					{/* Pagination */}
					{totalPages > 1 && (
						<Group justify="center" mt="lg">
							<Pagination
								total={totalPages}
								value={activePage}
								onChange={setActivePage}
								size="md"
								withEdges
							/>
						</Group>
					)}

					{paginatedInstances.map((semesterGroup) => (
						<Stack key={semesterGroup.semester} gap="md">
							<Title order={4} c="blue">
								{semesterGroup.semester}
							</Title>

							<Stack gap="md">
								{semesterGroup.sections.map((section) => (
									<Card
										key={section.shortcode}
										shadow="sm"
										padding="lg"
										radius="md"
										withBorder
									>
										<Stack gap="md">
											{/* Section Header */}
											<Group justify="space-between" align="flex-start">
												<Stack gap={4}>
													<Text fw={600} size="lg">
														{section.shortcode}
													</Text>
													<Text size="sm" c="dimmed">
														Section {section.section}
													</Text>
												</Stack>
												<Badge
													size="lg"
													color={
														section.status === "completed"
															? "gray"
															: section.status === "in progress"
																? "blue"
																: section.status === "open"
																	? "green"
																	: "grape"
													}
												>
													{section.status}
												</Badge>
											</Group>

											{/* Section Details */}
											<Group gap="xl" wrap="wrap">
												<Group gap="xs">
													<IconUser
														size={18}
														color="var(--mantine-color-dimmed)"
													/>
													<Stack gap={0}>
														<Text size="xs" c="dimmed">
															Instructor
														</Text>
														<Text size="sm" fw={500}>
															{section.instructor}
														</Text>
													</Stack>
												</Group>

												<Group gap="xs">
													<IconCalendar
														size={18}
														color="var(--mantine-color-dimmed)"
													/>
													<Stack gap={0}>
														<Text size="xs" c="dimmed">
															Days
														</Text>
														<Text size="sm" fw={500}>
															{section.days}
														</Text>
													</Stack>
												</Group>

												<Group gap="xs">
													<IconClock
														size={18}
														color="var(--mantine-color-dimmed)"
													/>
													<Stack gap={0}>
														<Text size="xs" c="dimmed">
															Time
														</Text>
														<Text size="sm" fw={500}>
															{section.time}
														</Text>
													</Stack>
												</Group>

												<Group gap="xs">
													<IconMapPin
														size={18}
														color="var(--mantine-color-dimmed)"
													/>
													<Stack gap={0}>
														<Text size="xs" c="dimmed">
															Location
														</Text>
														<Text size="sm" fw={500}>
															{section.location}
														</Text>
													</Stack>
												</Group>

												<Group gap="xs">
													<IconUsers
														size={18}
														color="var(--mantine-color-dimmed)"
													/>
													<Stack gap={0}>
														<Text size="xs" c="dimmed">
															Enrollment
														</Text>
														<Text size="sm" fw={500}>
															{section.enrolled} / {section.capacity}
														</Text>
													</Stack>
												</Group>
											</Group>
										</Stack>
									</Card>
								))}
							</Stack>
						</Stack>
					))}

					{/* Pagination */}
					{totalPages > 1 && (
						<Group justify="center" mt="lg">
							<Pagination
								total={totalPages}
								value={activePage}
								onChange={setActivePage}
								size="md"
								withEdges
							/>
						</Group>
					)}
				</Stack>
			</Stack>
		</Container>
	);
}
