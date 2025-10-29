import {
	Avatar,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { useQueryState } from "nuqs";
import { courseContextKey } from "server/contexts/course-context";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const courseContext = context.get(courseContextKey);

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	return {
		course: courseContext.course,
		gradebook: courseContext.gradebook,
		gradebookJson: courseContext.gradebookJson,
		enrollments: courseContext.course.enrollments.filter(
			(e) => e.status === "active",
		),
	};
};

function GraderReportView({
	loaderData,
}: {
	loaderData: Route.ComponentProps["loaderData"];
}) {
	const { enrollments, gradebookJson } = loaderData;

	if (!gradebookJson) {
		return (
			<Paper withBorder p="xl">
				<Text c="dimmed" ta="center">
					No gradebook has been set up for this course yet.
				</Text>
			</Paper>
		);
	}

	const { gradebook_setup } = gradebookJson;

	// Flatten items for column headers
	const allItems: Array<{
		id: number;
		name: string;
		type: string;
		maxGrade: number | null;
	}> = [];

	for (const item of gradebook_setup.items) {
		if (item.type === "category" && item.grade_items) {
			// Add items within category
			for (const gradeItem of item.grade_items) {
				allItems.push({
					id: gradeItem.id,
					name: `${item.name} / ${gradeItem.name}`,
					type: gradeItem.type,
					maxGrade: gradeItem.max_grade,
				});
			}
		} else {
			// Root-level manual item
			allItems.push({
				id: item.id,
				name: item.name,
				type: item.type,
				maxGrade: item.max_grade,
			});
		}
	}

	return (
		<Paper withBorder>
			<ScrollArea>
				<Table striped highlightOnHover stickyHeader>
					<Table.Thead>
						<Table.Tr>
							<Table.Th style={{ minWidth: 200 }}>Student</Table.Th>
							{allItems.map((item) => (
								<Table.Th key={item.id} style={{ minWidth: 150 }}>
									<Stack gap={4}>
										<Text size="sm" fw={500}>
											{item.name}
										</Text>
										<Text size="xs" c="dimmed">
											{item.maxGrade !== null ? `/ ${item.maxGrade}` : ""}
										</Text>
									</Stack>
								</Table.Th>
							))}
							<Table.Th style={{ minWidth: 100 }}>Total</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{enrollments.length === 0 ? (
							<Table.Tr>
								<Table.Td colSpan={allItems.length + 2}>
									<Text c="dimmed" ta="center" py="xl">
										No active students enrolled in this course.
									</Text>
								</Table.Td>
							</Table.Tr>
						) : (
							enrollments.map((enrollment: (typeof enrollments)[number]) => (
								<Table.Tr key={enrollment.id}>
									<Table.Td>
										<Group gap="sm">
											<Avatar size="sm" radius="xl" color="blue">
												{enrollment.name.charAt(0)}
											</Avatar>
											<div>
												<Text size="sm" fw={500}>
													{enrollment.name}
												</Text>
												<Text size="xs" c="dimmed">
													{enrollment.email}
												</Text>
											</div>
										</Group>
									</Table.Td>
									{allItems.map((item) => (
										<Table.Td key={item.id}>
											<Text size="sm" c="dimmed">
												-
											</Text>
										</Table.Td>
									))}
									<Table.Td>
										<Text size="sm" fw={500}>
											-
										</Text>
									</Table.Td>
								</Table.Tr>
							))
						)}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}

function GradebookSetupView({
	loaderData,
}: {
	loaderData: Route.ComponentProps["loaderData"];
}) {
	const { gradebookJson } = loaderData;

	if (!gradebookJson) {
		return (
			<Paper withBorder p="xl">
				<Stack gap="md" align="center">
					<Text c="dimmed" ta="center">
						No gradebook has been set up for this course yet.
					</Text>
					<Button disabled>Create Gradebook</Button>
				</Stack>
			</Paper>
		);
	}

	const { gradebook_setup } = gradebookJson;

	const getTypeColor = (type: string) => {
		switch (type) {
			case "assignment":
				return "blue";
			case "quiz":
				return "grape";
			case "discussion":
				return "teal";
			case "page":
				return "cyan";
			case "whiteboard":
				return "orange";
			case "category":
				return "gray";
			default:
				return "gray";
		}
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={3}>Gradebook Structure</Title>
				<Button disabled>Edit Setup</Button>
			</Group>

			<Paper withBorder>
				<Table>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Name</Table.Th>
							<Table.Th>Type</Table.Th>
							<Table.Th>Weight</Table.Th>
							<Table.Th>Max Grade</Table.Th>
							<Table.Th>Actions</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{gradebook_setup.items.length === 0 ? (
							<Table.Tr>
								<Table.Td colSpan={5}>
									<Text c="dimmed" ta="center" py="xl">
										No gradebook items configured yet.
									</Text>
								</Table.Td>
							</Table.Tr>
						) : (
							gradebook_setup.items.map(
								(item: (typeof gradebook_setup.items)[number]) => (
									<>
										<Table.Tr key={item.id}>
											<Table.Td>
												<Text fw={item.type === "category" ? 600 : 500}>
													{item.name}
												</Text>
											</Table.Td>
											<Table.Td>
												<Badge color={getTypeColor(item.type)} size="sm">
													{item.type}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Text size="sm">
													{item.weight !== null ? `${item.weight}%` : "-"}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">
													{item.max_grade !== null ? item.max_grade : "-"}
												</Text>
											</Table.Td>
											<Table.Td>
												<Button size="xs" variant="subtle" disabled>
													Edit
												</Button>
											</Table.Td>
										</Table.Tr>
										{item.type === "category" &&
											item.grade_items &&
											item.grade_items.map(
												(
													gradeItem: NonNullable<
														(typeof item.grade_items)
													>[number],
												) => (
													<Table.Tr key={gradeItem.id}>
														<Table.Td>
															<Box pl="xl">
																<Text size="sm">↳ {gradeItem.name}</Text>
															</Box>
														</Table.Td>
														<Table.Td>
															<Badge color={getTypeColor(gradeItem.type)} size="sm">
																{gradeItem.type}
															</Badge>
														</Table.Td>
														<Table.Td>
															<Text size="sm">
																{gradeItem.weight !== null
																	? `${gradeItem.weight}%`
																	: "-"}
															</Text>
														</Table.Td>
														<Table.Td>
															<Text size="sm">
																{gradeItem.max_grade !== null
																	? gradeItem.max_grade
																	: "-"}
															</Text>
														</Table.Td>
														<Table.Td>
															<Button size="xs" variant="subtle" disabled>
																Edit
															</Button>
														</Table.Td>
													</Table.Tr>
												),
											)}
									</>
								),
							)
						)}
					</Table.Tbody>
				</Table>
			</Paper>
		</Stack>
	);
}

export default function CourseGradesPage({
	loaderData,
}: Route.ComponentProps) {
	const [activeTab] = useQueryState("tab", {
		defaultValue: "report",
	});

	return (
		<>
			{activeTab === "setup" ? (
				<GradebookSetupView loaderData={loaderData} />
			) : (
				<GraderReportView loaderData={loaderData} />
			)}
		</>
	);
}
