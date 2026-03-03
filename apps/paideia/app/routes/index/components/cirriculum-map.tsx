import { Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import {
	Background,
	Controls,
	type Edge,
	type Node,
	Position,
	ReactFlow,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import { href, Link } from "react-router";

// Curriculum Map Component with Semester-based Layout (Left to Right)
export function CurriculumMap({
	courses,
	isVisible,
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
		section?: string;
		shortcode?: string;
	}>;
	isVisible: boolean;
}) {
	// Get ReactFlow instance to access its methods
	const reactFlowInstance = useReactFlow();

	// Fit view when map becomes visible
	useEffect(() => {
		if (isVisible) {
			// Small timeout to ensure ReactFlow is fully rendered
			const timeoutId = setTimeout(() => {
				reactFlowInstance.fitView({ padding: 0.1, duration: 400 });
			}, 50);
			return () => clearTimeout(timeoutId);
		}
	}, [isVisible, reactFlowInstance]);

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
											{course.isCompulsory ? "Compulsory" : "Elective"} •{" "}
											{course.credits} credits
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
							<Link
								to={
									href("/catalog") + `?code=${course.code.replace(/\s+/g, "-")}`
								}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Stack gap={6}>
									<Text size="xs" fw={600} c="dimmed">
										{course.status === "completed" ||
										course.status === "in progress"
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
							</Link>
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
			connectable: false,
			deletable: false,
			draggable: false,
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
				<Controls showInteractive={false} />
			</ReactFlow>
		</Box>
	);
}
