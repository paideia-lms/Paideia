import {
	Badge,
	Box,
	Button,
	Card,
	Collapse,
	Container,
	Grid,
	Group,
	Paper,
	Progress,
	SimpleGrid,
	Stack,
	Text,
	ThemeIcon,
	Title,
	Tooltip,
} from "@mantine/core";
import {
	Background,
	Controls,
	type Edge,
	type Node,
	Position,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	IconBook,
	IconBooks,
	IconCalendar,
	IconChartBar,
	IconChevronDown,
	IconChevronUp,
	IconClock,
	IconFileText,
	IconLogin,
	IconMap2,
	IconMessageCircle,
	IconNotes,
	IconSchool,
	IconUserPlus,
	IconUsers,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useState } from "react";
import { href, Link } from "react-router";
import { userContextKey } from "server/contexts/user-context";
import type { Route } from "./+types/index";

// Utility function to format schedule string
export function formatSchedule(schedule: string): string {
	// Convert day names to abbreviations
	const dayMap: Record<string, string> = {
		Monday: "Mon",
		Tuesday: "Tue",
		Wednesday: "Wed",
		Thursday: "Thu",
		Friday: "Fri",
		Saturday: "Sat",
		Sunday: "Sun",
	};

	// Replace full day names with abbreviations
	let formatted = schedule;
	for (const [full, abbr] of Object.entries(dayMap)) {
		formatted = formatted.replace(new RegExp(full, "g"), abbr);
	}

	// Remove "and " before the last day
	formatted = formatted.replace(/and /g, "");

	// Simplify time format: "10:00 AM" -> "10AM"
	formatted = formatted.replace(/:00/g, "");
	formatted = formatted.replace(/ /g, "");

	// Convert "," to " •"
	formatted = formatted.replace(/,/g, " •");

	return formatted;
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		// Public user - mock featured courses
		const featuredCourses = [
			{
				id: 1,
				title: "Introduction to Computer Science",
				description:
					"Learn the fundamentals of programming and computer science concepts",
				slug: "cs-101",
				category: "Computer Science",
				thumbnailUrl: null,
			},
			{
				id: 2,
				title: "Data Structures and Algorithms",
				description:
					"Master essential data structures and algorithmic thinking",
				slug: "cs-201",
				category: "Computer Science",
				thumbnailUrl: null,
			},
			{
				id: 3,
				title: "Web Development Fundamentals",
				description:
					"Build modern web applications with HTML, CSS, and JavaScript",
				slug: "web-101",
				category: "Web Development",
				thumbnailUrl: null,
			},
			{
				id: 4,
				title: "Database Design",
				description: "Learn to design and implement relational databases",
				slug: "db-101",
				category: "Database",
				thumbnailUrl: null,
			},
			{
				id: 5,
				title: "Business Analytics",
				description: "Use data to drive business decisions",
				slug: "ba-101",
				category: "Business",
				thumbnailUrl: null,
			},
			{
				id: 6,
				title: "Digital Marketing",
				description: "Master the art of marketing in the digital age",
				slug: "dm-101",
				category: "Marketing",
				thumbnailUrl: null,
			},
		];

		return {
			isAuthenticated: false as const,
			featuredCourses,
		};
	}

	// Authenticated user
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Mock recent courses
	const recentCourses = [
		{
			id: 1,
			title: "Information Security",
			shortcode: "COMP 301 FA 2025",
			slug: "cs-301",
			category: "Computer Science",
			status: "active" as const,
			role: "student" as const,
			completionPercentage: 65,
			thumbnailUrl: null,
			schedule: "Monday and Wednesday, 10:00 AM - 12:00 PM",
		},
		{
			id: 2,
			title: "Databases",
			shortcode: "COMP 280 FA 2025",
			slug: "cs-280",
			category: "Computer Science",
			status: "active" as const,
			role: "student" as const,
			completionPercentage: 45,
			thumbnailUrl: null,
			schedule: "Tuesday and Thursday, 2:00 PM - 4:00 PM",
		},
		{
			id: 3,
			title: "Functional Programming",
			shortcode: "COMP 330 FA 2025",
			slug: "cs-330",
			category: "Computer Science",
			status: "active" as const,
			role: "student" as const,
			completionPercentage: 80,
			thumbnailUrl: null,
			schedule: "Monday, Wednesday, and Friday, 9:00 AM - 10:00 AM",
		},
		{
			id: 4,
			title: "User-Centered Design",
			shortcode: "COMP 200 SP 2025",
			slug: "cs-200",
			category: "Design",
			status: "completed" as const,
			role: "student" as const,
			completionPercentage: 100,
			thumbnailUrl: null,
			schedule: "Tuesday and Thursday, 10:00 AM - 12:00 PM",
		},
	];

	// Mock recent notes
	const recentNotes = [
		{
			id: 1,
			title: "Week 3: SQL Injection Attacks",
			createdAt: dayjs().subtract(1, "day").toISOString(),
		},
		{
			id: 2,
			title: "Typography Notes",
			createdAt: dayjs().subtract(3, "days").toISOString(),
		},
		{
			id: 3,
			title: "NoSQL vs SQL Comparison",
			createdAt: dayjs().subtract(5, "days").toISOString(),
		},
	];

	// Mock today's course meetings
	const todaysCourseMeetings = [
		{
			id: 1,
			shortcode: "COMP 301 FA 2025",
			title: "Information Security",
			startTime: "10:00 AM",
			endTime: "12:00 PM",
			courseId: 1,
		},
		{
			id: 2,
			shortcode: "COMP 330 FA 2025",
			title: "Functional Programming",
			startTime: "9:00 AM",
			endTime: "10:00 AM",
			courseId: 3,
		},
	];

	// Mock today's due items
	const todaysDueItems: Array<{
		id: number;
		title: string;
		type: "assignment" | "quiz" | "discussion";
		dueDate: string;
		courseTitle: string;
		courseId: number;
	}> = [
			{
				id: 1,
				title: "Databases CW1",
				type: "assignment" as const,
				dueDate: dayjs().hour(10).minute(0).toISOString(),
				courseTitle: "Databases",
				courseId: 2,
			},
			{
				id: 2,
				title: "Functional Programming CW2",
				type: "assignment" as const,
				dueDate: dayjs().hour(16).minute(0).toISOString(),
				courseTitle: "Functional Programming",
				courseId: 3,
			},
			{
				id: 3,
				title: "Week 1: Object Oriented vs Functional Programming",
				type: "discussion" as const,
				dueDate: dayjs().hour(23).minute(59).toISOString(),
				courseTitle: "Functional Programming",
				courseId: 3,
			},
		];

	// Mock program data
	const mockProgram = {
		id: 1,
		name: "Bachelor in Business Administration",
		description: "Comprehensive business administration program",
		totalCredits: 120,
		completedCredits: 60,
	};

	// Mock curriculum map data with prerequisites - organized by semester
	const mockCurriculumCourses = [
		// Year 1 - Fall (Semester 1)
		{
			id: 1,
			code: "COMP 101",
			title: "Intro to Computer Science",
			status: "completed" as const,
			semester: 1,
			prerequisites: [],
			credits: 3,
			isCompulsory: true,
			shortcode: "COMP 101 FA 2023",
		},
		{
			id: 2,
			code: "COMP 110",
			title: "Programming Fundamentals",
			status: "completed" as const,
			semester: 1,
			prerequisites: [],
			credits: 4,
			isCompulsory: true,
			shortcode: "COMP 110 FA 2023",
		},
		{
			id: 3,
			code: "MATH 140",
			title: "Mathematics for CS",
			status: "completed" as const,
			semester: 1,
			prerequisites: [],
			credits: 3,
			isCompulsory: true,
			shortcode: "MATH 140 FA 2023",
		},
		{
			id: 4,
			code: "COMM 150",
			title: "Business Communication",
			status: "completed" as const,
			semester: 1,
			prerequisites: [],
			credits: 3,
			isCompulsory: true,
			shortcode: "COMM 150 FA 2023",
		},
		{
			id: 5,
			code: "ECON 101",
			title: "Economics Principles",
			status: "completed" as const,
			semester: 1,
			prerequisites: [],
			credits: 3,
			isCompulsory: true,
			shortcode: "ECON 101 FA 2023",
		},

		// Year 1 - Spring (Semester 2)
		{
			id: 6,
			code: "COMP 210",
			title: "Data Structures",
			status: "completed" as const,
			semester: 2,
			prerequisites: [2],
			credits: 4,
			isCompulsory: true,
			shortcode: "COMP 210 SP 2024",
		},
		{
			id: 7,
			code: "MATH 250",
			title: "Discrete Mathematics",
			status: "completed" as const,
			semester: 2,
			prerequisites: [3],
			credits: 3,
			isCompulsory: true,
			shortcode: "MATH 250 SP 2024",
		},
		{
			id: 8,
			code: "ACCT 201",
			title: "Accounting Fundamentals",
			status: "completed" as const,
			semester: 2,
			prerequisites: [5],
			credits: 3,
			isCompulsory: true,
			shortcode: "ACCT 201 SP 2024",
		},
		{
			id: 9,
			code: "STAT 260",
			title: "Statistics for Business",
			status: "completed" as const,
			semester: 2,
			prerequisites: [3],
			credits: 4,
			isCompulsory: true,
			shortcode: "STAT 260 SP 2024",
		},
		{
			id: 10,
			code: "COMP 180",
			title: "Web Development",
			status: "completed" as const,
			semester: 2,
			prerequisites: [2],
			credits: 3,
			isCompulsory: true,
			shortcode: "COMP 180 SP 2024",
		},

		// Year 2 - Fall (Semester 3)
		{
			id: 11,
			code: "COMP 310",
			title: "Algorithms",
			status: "completed" as const,
			semester: 3,
			prerequisites: [6],
			credits: 4,
			isCompulsory: true,
			shortcode: "COMP 310 FA 2024",
		},
		{
			id: 12,
			code: "COMP 320",
			title: "Database Systems",
			status: "in progress" as const,
			semester: 3,
			prerequisites: [6],
			credits: 4,
			isCompulsory: true,
			shortcode: "COMP 320 FA 2025",
		},
		{
			id: 13,
			code: "FINC 301",
			title: "Financial Management",
			status: "in progress" as const,
			semester: 3,
			prerequisites: [8],
			credits: 3,
			isCompulsory: true,
			shortcode: "FINC 301 FA 2025",
		},
		{
			id: 14,
			code: "MKTG 301",
			title: "Marketing Principles",
			status: "in progress" as const,
			semester: 3,
			prerequisites: [5],
			credits: 3,
			isCompulsory: true,
			shortcode: "MKTG 301 FA 2025",
		},
		{
			id: 15,
			code: "COMP 330",
			title: "Operating Systems",
			status: "in progress" as const,
			semester: 3,
			prerequisites: [6],
			credits: 3,
			isCompulsory: true,
			shortcode: "COMP 330 FA 2025",
		},

		// Year 2 - Spring (Semester 4)
		{
			id: 16,
			code: "COMP 340",
			title: "Software Engineering",
			status: "future" as const,
			semester: 4,
			prerequisites: [11],
			credits: 4,
			isCompulsory: true,
		},
		{
			id: 17,
			code: "COMP 350",
			title: "Computer Networks",
			status: "future" as const,
			semester: 4,
			prerequisites: [15],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 18,
			code: "MGMT 360",
			title: "Business Analytics",
			status: "future" as const,
			semester: 4,
			prerequisites: [9, 12],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 19,
			code: "MKTG 370",
			title: "Digital Marketing",
			status: "future" as const,
			semester: 4,
			prerequisites: [14],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 20,
			code: "COMP 280",
			title: "Human-Computer Interaction",
			status: "future" as const,
			semester: 4,
			prerequisites: [10],
			credits: 3,
			isCompulsory: true,
		},

		// Year 3 - Fall (Semester 5)
		{
			id: 21,
			code: "COMP 410",
			title: "Information Security",
			status: "future" as const,
			semester: 5,
			prerequisites: [17],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 22,
			code: "COMP 420",
			title: "Machine Learning",
			status: "future" as const,
			semester: 5,
			prerequisites: [11, 9],
			credits: 4,
			isCompulsory: true,
		},
		{
			id: 23,
			code: "COMP 430",
			title: "Cloud Computing",
			status: "future" as const,
			semester: 5,
			prerequisites: [17],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 24,
			code: "MGMT 401",
			title: "Strategic Management",
			status: "future" as const,
			semester: 5,
			prerequisites: [13],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 25,
			code: "MGMT 410",
			title: "Entrepreneurship",
			status: "future" as const,
			semester: 5,
			prerequisites: [13, 14],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 26,
			code: "COMP 380",
			title: "Mobile App Development",
			status: "future" as const,
			semester: 5,
			prerequisites: [16],
			credits: 3,
			isCompulsory: false,
		},

		// Year 3 - Spring (Semester 6)
		{
			id: 27,
			code: "COMP 450",
			title: "Cybersecurity",
			status: "future" as const,
			semester: 6,
			prerequisites: [21],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 28,
			code: "COMP 460",
			title: "Deep Learning",
			status: "future" as const,
			semester: 6,
			prerequisites: [22],
			credits: 4,
			isCompulsory: false,
		},
		{
			id: 29,
			code: "COMP 470",
			title: "Distributed Systems",
			status: "future" as const,
			semester: 6,
			prerequisites: [23],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 30,
			code: "MGMT 470",
			title: "E-Commerce Systems",
			status: "future" as const,
			semester: 6,
			prerequisites: [18, 19],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 31,
			code: "MGMT 420",
			title: "Project Management",
			status: "future" as const,
			semester: 6,
			prerequisites: [16],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 32,
			code: "COMP 385",
			title: "UX Design",
			status: "future" as const,
			semester: 6,
			prerequisites: [20],
			credits: 3,
			isCompulsory: false,
		},

		// Year 4 - Fall (Semester 7)
		{
			id: 33,
			code: "COMP 510",
			title: "Blockchain Technology",
			status: "future" as const,
			semester: 7,
			prerequisites: [27, 29],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 34,
			code: "COMP 520",
			title: "Natural Language Processing",
			status: "future" as const,
			semester: 7,
			prerequisites: [28],
			credits: 4,
			isCompulsory: false,
		},
		{
			id: 35,
			code: "COMP 530",
			title: "Big Data Analytics",
			status: "future" as const,
			semester: 7,
			prerequisites: [18, 23],
			credits: 4,
			isCompulsory: true,
		},
		{
			id: 36,
			code: "MGMT 501",
			title: "Business Intelligence",
			status: "future" as const,
			semester: 7,
			prerequisites: [18, 24],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 37,
			code: "MGMT 510",
			title: "Innovation Management",
			status: "future" as const,
			semester: 7,
			prerequisites: [25],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 38,
			code: "COMP 480",
			title: "Advanced Web Technologies",
			status: "future" as const,
			semester: 7,
			prerequisites: [26],
			credits: 3,
			isCompulsory: false,
		},

		// Year 4 - Spring (Semester 8)
		{
			id: 39,
			code: "COMP 550",
			title: "IoT Systems",
			status: "future" as const,
			semester: 8,
			prerequisites: [33],
			credits: 3,
			isCompulsory: false,
		},
		{
			id: 40,
			code: "COMP 560",
			title: "Computer Vision",
			status: "future" as const,
			semester: 8,
			prerequisites: [34],
			credits: 4,
			isCompulsory: false,
		},
		{
			id: 41,
			code: "COMP 590",
			title: "Data Science Capstone",
			status: "future" as const,
			semester: 8,
			prerequisites: [35],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 42,
			code: "MGMT 590",
			title: "Business Strategy Capstone",
			status: "future" as const,
			semester: 8,
			prerequisites: [36, 37],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 43,
			code: "COMP 595",
			title: "Software Engineering Capstone",
			status: "future" as const,
			semester: 8,
			prerequisites: [31, 38],
			credits: 3,
			isCompulsory: true,
		},
		{
			id: 44,
			code: "RSRH 401",
			title: "Research Methods",
			status: "future" as const,
			semester: 8,
			prerequisites: [9],
			credits: 3,
			isCompulsory: true,
		},
	];

	return {
		isAuthenticated: true as const,
		user: {
			firstName: currentUser.firstName ?? "",
			lastName: currentUser.lastName ?? "",
		},
		program: mockProgram,
		curriculumCourses: mockCurriculumCourses,
		recentCourses,
		recentNotes,
		todaysCourseMeetings,
		todaysDueItems,
	};
};

// Curriculum Map Component with Semester-based Layout (Left to Right)
function CurriculumMap({
	courses,
}: {
	courses: Array<{
		id: number;
		code: string;
		title: string;
		status: "completed" | "in progress" | "future";
		semester: number;
		prerequisites: number[];
		credits: number;
		isCompulsory: boolean;
		shortcode?: string;
	}>;
}) {
	// Create course lookup map
	const courseMap = new Map(courses.map((c) => [c.id, c]));

	// Build reverse prerequisite map (courses that depend on this course)
	const dependentCourses = new Map<number, number[]>();
	for (const course of courses) {
		for (const prereqId of course.prerequisites) {
			if (!dependentCourses.has(prereqId)) {
				dependentCourses.set(prereqId, []);
			}
			const deps = dependentCourses.get(prereqId);
			if (deps) {
				deps.push(course.id);
			}
		}
	}

	// Group courses by semester
	const semesterGroups = new Map<number, typeof courses>();
	for (const course of courses) {
		if (!semesterGroups.has(course.semester)) {
			semesterGroups.set(course.semester, []);
		}
		const group = semesterGroups.get(course.semester);
		if (group) {
			group.push(course);
		}
	}

	// Get unique semesters and sort them
	const semesters = Array.from(semesterGroups.keys()).sort((a, b) => a - b);

	// Layout parameters
	const columnWidth = 300; // Horizontal spacing between semesters
	const rowHeight = 140; // Vertical spacing between courses
	const nodeWidth = 220;
	const labelHeight = 60; // Space for semester label at top

	// Create semester label nodes
	const semesterLabels: Node[] = semesters.map((semester, index) => {
		const year = Math.ceil(semester / 2);
		const term = semester % 2 === 1 ? "Fall" : "Spring";
		const label = `Year ${year} - ${term}`;

		return {
			id: `semester-${semester}`,
			type: "default",
			position: {
				x: index * columnWidth + 40,
				y: 0,
			},
			data: {
				label: (
					<Stack gap={4} align="center">
						<Text size="sm" fw={700} c="blue">
							Semester {semester}
						</Text>
						<Text size="xs" c="dimmed">
							{label}
						</Text>
					</Stack>
				),
			},
			style: {
				background: "transparent",
				border: "none",
				width: nodeWidth,
				textAlign: "center",
			},
			draggable: false,
			selectable: false,

		};
	});

	// Position course nodes in vertical columns by semester
	const courseNodes: Node[] = courses.map((course) => {
		const semesterIndex = semesters.indexOf(course.semester);
		const coursesInSemester = semesterGroups.get(course.semester) || [];
		const indexInSemester = coursesInSemester.findIndex(
			(c) => c.id === course.id,
		);

		// Get prerequisite courses
		const prereqCourses = course.prerequisites
			.map((id) => courseMap.get(id))
			.filter(Boolean);

		// Get dependent courses (courses that require this course)
		const dependents = dependentCourses.get(course.id) || [];
		const dependentCoursesForThis = dependents
			.map((id) => courseMap.get(id))
			.filter(Boolean);

		// Build tooltip content
		const hasPrereqs = prereqCourses.length > 0;
		const hasDependents = dependentCoursesForThis.length > 0;

		return {
			id: course.id.toString(),
			position: {
				x: semesterIndex * columnWidth + 40,
				y: labelHeight + indexInSemester * rowHeight + 40,
			},
			data: {
				label: (
					<>
						<Tooltip
							label={
								<Stack gap="xs">
									<div>
										<Text size="xs" fw={700}>
											{course.isCompulsory ? "Compulsory" : "Elective"} • {course.credits} credits
										</Text>
									</div>
									{hasPrereqs && (
										<div>
											<Text size="xs" fw={700} mb={4}>
												Prerequisites:
											</Text>
											{prereqCourses.map((prereq) => (
												<Text key={prereq.id} size="xs">
													• {prereq.code}: {prereq.title}
												</Text>
											))}
										</div>
									)}
									{hasDependents && (
										<div>
											<Text size="xs" fw={700} mb={4} mt={hasPrereqs ? 8 : 0}>
												Required for:
											</Text>
											{dependentCoursesForThis.map((dep) => (
												<Text key={dep.id} size="xs">
													• {dep.code}: {dep.title}
												</Text>
											))}
										</div>
									)}
									{!hasPrereqs && !hasDependents && (
										<Text size="xs">No prerequisites or dependent courses</Text>
									)}
								</Stack>
							}
							multiline
							w={300}
							withArrow
							position="top"
						>
							<Stack gap={6}>
								<Text size="xs" fw={600} c="dimmed">
									{course.status === "completed" || course.status === "in progress"
										? course.shortcode
										: course.code}
								</Text>
								<Text size="xs" fw={500} lineClamp={2}>
									{course.title}
								</Text>
								<Group gap={4}>
									<Badge
										size="xs"
										color={
											course.status === "completed"
												? "green"
												: course.status === "in progress"
													? "blue"
													: "gray"
										}
									>
										{course.status}
									</Badge>
									{!course.isCompulsory && (
										<Badge size="xs" color="violet" variant="light">
											Elective
										</Badge>
									)}
								</Group>
								<Text size="xs" c="dimmed">
									{course.credits} cr
								</Text>
							</Stack>
						</Tooltip>
					</>
				),
			},
			style: {
				borderRadius: 8,
				padding: 10,
				width: nodeWidth,
				fontSize: 12,
			},
			sourcePosition: Position.Right,
			targetPosition: Position.Left,
		};
	});

	// Combine semester labels and course nodes
	const allNodes = [...semesterLabels, ...courseNodes];

	// Create edges for prerequisites
	const edges: Edge[] = [];
	for (const course of courses) {
		for (const prereqId of course.prerequisites) {
			edges.push({
				id: `${prereqId}-${course.id}`,
				source: prereqId.toString(),
				target: course.id.toString(),
				animated: course.status === "in progress",
				type: "default",
				style: {
					stroke:
						course.status === "completed"
							? "var(--mantine-color-green-6)"
							: course.status === "in progress"
								? "var(--mantine-color-blue-6)"
								: "var(--mantine-color-gray-6)",
					strokeWidth: 2,
				},
			});
		}
	}

	return (
		<Box style={{ height: 700, width: "100%" }}>
			<ReactFlow nodes={allNodes} edges={edges} fitView>
				<Background />
				<Controls />
			</ReactFlow>
		</Box>
	);
}

// Authenticated Dashboard Component
function AuthenticatedDashboard({
	loaderData,
}: {
	loaderData: Exclude<
		Awaited<ReturnType<typeof loader>>,
		{ isAuthenticated: false }
	>;
}) {
	const [showCurriculumMap, setShowCurriculumMap] = useState(false);

	if (!loaderData.isAuthenticated) return null;

	const {
		user,
		program,
		curriculumCourses,
		recentCourses,
		recentNotes,
		todaysCourseMeetings,
		todaysDueItems,
	} = loaderData;

	const hour = new Date().getHours();
	const greeting =
		hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
	const userName = user.firstName || "there";

	// Sort today's schedule by start time, then end time
	const sortedScheduleItems = [
		...todaysCourseMeetings.map((meeting) => ({
			type: "meeting" as const,
			data: meeting,
			startTime: dayjs(`${dayjs().format("YYYY-MM-DD")} ${meeting.startTime}`, "YYYY-MM-DD h:mm A"),
			endTime: dayjs(`${dayjs().format("YYYY-MM-DD")} ${meeting.endTime}`, "YYYY-MM-DD h:mm A"),
		})),
		...todaysDueItems.map((item) => ({
			type: "due" as const,
			data: item,
			startTime: undefined,
			endTime: dayjs(item.dueDate),
		})),
	].sort((a, b) => {
		// Sort by start time first, if either one has no start time, sort to the end
		if (!a.startTime || !b.startTime) return a.endTime.valueOf() - b.endTime.valueOf();
		const startCompare = a.startTime.valueOf() - b.startTime.valueOf();
		if (startCompare !== 0) return startCompare;
		// Then by end time
		return a.endTime.valueOf() - b.endTime.valueOf();
	});

	return (
		<Container size="xl" py="xl">
			<Stack gap="xl">
				{/* Greeting Header */}
				<Group justify="space-between" align="flex-start">
					<Stack gap="xs">
						<Title order={1}>
							{greeting}, {userName}!
						</Title>
						<Text c="dimmed" size="lg">
							It's {dayjs().format("dddd, MMMM D, YYYY")}
						</Text>
					</Stack>
					<Group>
						<Button
							component={Link}
							to={href("/course")}
							leftSection={<IconBooks size={16} />}
							variant="light"
						>
							My Courses
						</Button>
						<Button
							component={Link}
							to={href("/user/overview/:id?", { id: undefined })}
							leftSection={<IconSchool size={16} />}
							variant="outline"
						>
							Profile
						</Button>
					</Group>
				</Group>

				{/* Program Card with Expandable Curriculum Map */}
				<Paper withBorder shadow="sm" p="lg" radius="md">
					<Stack gap="md">
						<Group justify="space-between" align="center">
							<Group>
								<ThemeIcon size="xl" radius="md" variant="light" color="blue">
									<IconSchool size={28} />
								</ThemeIcon>
								<Stack gap={4}>
									<Text size="sm" c="dimmed">
										Current Program
									</Text>
									<Title order={3}>{program.name}</Title>
									<Text size="sm" c="dimmed">
										{program.description}
									</Text>
								</Stack>
							</Group>
							<Button
								variant="transparent"
								leftSection={<IconMap2 size={16} />}
								rightSection={
									showCurriculumMap ? (
										<IconChevronUp size={16} />
									) : (
										<IconChevronDown size={16} />
									)
								}
								onClick={() => setShowCurriculumMap(!showCurriculumMap)}
							>
								{showCurriculumMap ? "Hide" : "Show"} Curriculum Map
							</Button>
						</Group>

						{/* Credit Progress */}
						<Stack gap="xs">
							<Group justify="space-between">
								<Text size="sm" fw={500}>
									{program.completedCredits} of {program.totalCredits} credits completed
								</Text>
								<Text size="sm" c="dimmed">
									{program.totalCredits - program.completedCredits} remaining
								</Text>
							</Group>
							<Progress
								value={(program.completedCredits / program.totalCredits) * 100}
								size="lg"
								radius="xl"
								color="blue"
							/>
						</Stack>

						{/* Collapsible Curriculum Map */}
						{curriculumCourses.length > 0 && (
							<Collapse in={showCurriculumMap}>
								<Stack gap="md" pt="md">
									<Group justify="space-between">
										<Title order={4}>Curriculum Map</Title>
										<Text size="sm" c="dimmed">
											Track your program progress
										</Text>
									</Group>
									<CurriculumMap courses={curriculumCourses} />
								</Stack>
							</Collapse>
						)}
					</Stack>
				</Paper>

				<Grid>
					{/* Recent Courses */}
					<Grid.Col span={{ base: 12, lg: 8 }}>
						<Stack gap="md">
							<Group justify="space-between">
								<Title order={3}>Recent Courses</Title>
								<Button
									component={Link}
									to={href("/course")}
									variant="subtle"
									size="sm"
								>
									View All
								</Button>
							</Group>
							<SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
								{recentCourses.map((course) => (
									<Card
										key={course.id}
										component={Link}
										to={href("/course/:id", { id: course.id.toString() })}
										shadow="sm"
										padding="lg"
										radius="md"
										withBorder
										style={{ cursor: "pointer", textDecoration: "none" }}
									>
										<Stack gap="sm">
											<Paper
												withBorder
												shadow="xs"
												style={{
													height: 100,
													// borderColor: "var(--mantine-color-gray-2)",
													borderRadius: 8,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<IconBook
													size={32}
													color="var(--mantine-color-dimmed)"
												/>
											</Paper>
											<Text size="xs" c="dimmed" fw={600}>
												{course.shortcode}
											</Text>
											<Text fw={500} lineClamp={2}>
												{course.title}
											</Text>
											{course.schedule && (
												<Group gap={4}>
													<IconClock size={14} color="var(--mantine-color-dimmed)" />
													<Text size="xs" c="dimmed" lineClamp={1}>
														{formatSchedule(course.schedule)}
													</Text>
												</Group>
											)}
											{course.category && (
												<Badge size="sm" variant="light">
													{course.category}
												</Badge>
											)}
											<Badge
												size="sm"
												color={
													course.status === "active"
														? "green"
														: course.status === "completed"
															? "blue"
															: "gray"
												}
											>
												{course.status}
											</Badge>
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
									</Card>
								))}
							</SimpleGrid>
							{recentCourses.length === 0 && (
								<Paper withBorder p="xl" radius="md">
									<Stack align="center" gap="md">
										<IconBooks size={48} color="var(--mantine-color-dimmed)" />
										<Text c="dimmed">No courses enrolled yet</Text>
										<Button component={Link} to={href("/course")}>
											Browse Courses
										</Button>
									</Stack>
								</Paper>
							)}
						</Stack>
					</Grid.Col>

					{/* Sidebar */}
					<Grid.Col span={{ base: 12, lg: 4 }}>
						<Stack gap="md">
							{/* Calendar Widget */}
							<Paper withBorder shadow="sm" p="md" radius="md">
								<Stack gap="md">
									<Group>
										<ThemeIcon radius="md" variant="light" color="orange">
											<IconCalendar size={20} />
										</ThemeIcon>
										<Title order={4}>Today's Schedule</Title>
									</Group>
									{sortedScheduleItems.length > 0 ? (
										<Stack gap="xs">
											{sortedScheduleItems.map((item) => {
												if (item.type === "meeting") {
													const meeting = item.data;
													return (
														<Paper key={`meeting-${meeting.id}`} withBorder p="sm" radius="md" >
															<Stack gap={4}>
																<Group justify="space-between">
																	<Text size="sm" fw={500} lineClamp={1}>
																		{meeting.title}
																	</Text>
																	<Badge size="xs" color="cyan" variant="light" >
																		Class
																	</Badge>
																</Group>
																<Text size="xs" c="dimmed" fw={500}>
																	{meeting.shortcode}
																</Text>
																<Group gap={4}>
																	<IconClock size={12} color="var(--mantine-color-dimmed)" />
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

							{/* Recent Notes */}
							<Paper withBorder shadow="sm" p="md" radius="md">
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
											to={href("/user/notes/:id?", { id: undefined })}
											variant="subtle"
											size="xs"
										>
											View All
										</Button>
									</Group>
									{recentNotes.length > 0 ? (
										<Stack gap="xs">
											{recentNotes.map((note) => (
												<Paper key={note.id} withBorder p="sm" radius="md">
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
							</Paper>
						</Stack>
					</Grid.Col>
				</Grid>
			</Stack>
		</Container>
	);
}

// Public Dashboard Component
function PublicDashboard({
	loaderData,
}: {
	loaderData: Extract<
		Awaited<ReturnType<typeof loader>>,
		{ isAuthenticated: false }
	>;
}) {
	if (loaderData.isAuthenticated) return null;

	const { featuredCourses } = loaderData;

	return (
		<Container size="xl" py="xl">
			<Stack gap="xl">
				{/* Hero Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Stack gap="lg" align="center" ta="center">
						<ThemeIcon size={80} radius="md" variant="gradient">
							<IconSchool size={48} />
						</ThemeIcon>
						<Stack gap="xs">
							<Title order={1} size="h1">
								Welcome to Paideia LMS
							</Title>
							<Text size="lg" c="dimmed" maw={600}>
								A modern, flexible, and powerful Learning Management System
								designed for the future of education
							</Text>
						</Stack>
						<Group>
							<Button
								component={Link}
								to={href("/login")}
								size="lg"
								leftSection={<IconLogin size={20} />}
							>
								Login
							</Button>
							<Button
								component={Link}
								to={"#"}
								size="lg"
								variant="outline"
								leftSection={<IconUserPlus size={20} />}
							>
								Register
							</Button>
						</Group>
					</Stack>
				</Paper>

				{/* Featured Courses */}
				{featuredCourses.length > 0 && (
					<Stack gap="md">
						<Title order={2}>Featured Courses</Title>
						<SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
							{featuredCourses.map((course) => (
								<Card
									key={course.id}
									shadow="sm"
									padding="lg"
									radius="md"
									withBorder
								>
									<Stack gap="sm">
										<div
											style={{
												height: 140,
												borderRadius: 8,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<IconBook size={48} color="var(--mantine-color-dimmed)" />
										</div>
										<Text fw={500} lineClamp={2}>
											{course.title}
										</Text>
										<Text size="sm" c="dimmed" lineClamp={3}>
											{course.description}
										</Text>
										{course.category && (
											<Badge size="sm" variant="light">
												{course.category}
											</Badge>
										)}
									</Stack>
								</Card>
							))}
						</SimpleGrid>
					</Stack>
				)}

				{/* Features Showcase */}
				<Stack gap="md">
					<Title order={2}>Platform Features</Title>
					<SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="blue">
									<IconBooks size={28} />
								</ThemeIcon>
								<Text fw={500}>Course Management</Text>
								<Text size="sm" c="dimmed">
									Organize and deliver content with hierarchical course
									structures
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="green">
									<IconChartBar size={28} />
								</ThemeIcon>
								<Text fw={500}>Grade Tracking</Text>
								<Text size="sm" c="dimmed">
									Comprehensive gradebook with flexible grading categories
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="orange">
									<IconMessageCircle size={28} />
								</ThemeIcon>
								<Text fw={500}>Discussions</Text>
								<Text size="sm" c="dimmed">
									Engage students with interactive discussion forums
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="violet">
									<IconFileText size={28} />
								</ThemeIcon>
								<Text fw={500}>Rich Content</Text>
								<Text size="sm" c="dimmed">
									Create assignments, quizzes, and notes with powerful editors
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="red">
									<IconUsers size={28} />
								</ThemeIcon>
								<Text fw={500}>User Management</Text>
								<Text size="sm" c="dimmed">
									Role-based access control with flexible permissions
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="cyan">
									<IconNotes size={28} />
								</ThemeIcon>
								<Text fw={500}>Personal Notes</Text>
								<Text size="sm" c="dimmed">
									Keep track of learning with personal note-taking
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="pink">
									<IconSchool size={28} />
								</ThemeIcon>
								<Text fw={500}>Program Tracking</Text>
								<Text size="sm" c="dimmed">
									Visualize curriculum with prerequisite mapping
								</Text>
							</Stack>
						</Card>

						<Card shadow="sm" padding="lg" radius="md" withBorder>
							<Stack align="center" gap="sm" ta="center">
								<ThemeIcon size="xl" radius="md" variant="light" color="yellow">
									<IconCalendar size={28} />
								</ThemeIcon>
								<Text fw={500}>Calendar & Scheduling</Text>
								<Text size="sm" c="dimmed">
									Stay organized with integrated calendar and due dates
								</Text>
							</Stack>
						</Card>
					</SimpleGrid>
				</Stack>
			</Stack>
		</Container>
	);
}

export default function Index({ loaderData }: Route.ComponentProps) {
	return (
		<>
			<title>
				{loaderData.isAuthenticated
					? "Dashboard | Paideia LMS"
					: "Paideia LMS | Learning Management System"}
			</title>
			<meta
				name="description"
				content="Paideia Learning Management System - Modern, flexible, and powerful LMS for education"
			/>
			<meta
				property="og:title"
				content={
					loaderData.isAuthenticated
						? "Dashboard | Paideia LMS"
						: "Paideia LMS | Learning Management System"
				}
			/>
			<meta
				property="og:description"
				content="Paideia Learning Management System - Modern, flexible, and powerful LMS for education"
			/>

			{loaderData.isAuthenticated ? (
				<AuthenticatedDashboard loaderData={loaderData} />
			) : (
				<PublicDashboard loaderData={loaderData} />
			)}
		</>
	);
}
