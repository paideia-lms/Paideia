import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import {
	tryCreateCourseActivityModuleLink,
	tryDeleteCourseActivityModuleLink,
	tryFindLinksByCourse,
} from "server/internal/course-activity-module-link-management";
import type { Course } from "server/payload-types";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course-view.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const courseContext = context.get(courseContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
		throw new ForbiddenResponse(
			"Only admins and content managers can view courses",
		);
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			error: "Invalid course ID",
		});
	}

	// Course context must be defined, otherwise throw not found response
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found");
	}

	const course = courseContext.course;

	const createdByName = course.createdBy
		? `${course.createdBy.firstName || ""} ${course.createdBy.lastName || ""}`.trim() ||
			course.createdBy.email
		: "Unknown";

	// Fetch existing course-activity-module links
	const linksResult = await tryFindLinksByCourse(payload, courseId);
	const existingLinks = linksResult.ok ? linksResult.value : [];

	// Fetch available activity modules the user can access
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: currentUser.id,
		limit: 100,
	});
	const availableModules = modulesResult.ok ? modulesResult.value.docs : [];

	return {
		course: {
			id: course.id,
			title: course.title,
			slug: course.slug,
			description: course.description,
			status: course.status,
			createdBy: createdByName,
			createdById: course.createdBy.id,
			createdAt: course.createdAt,
			updatedAt: course.updatedAt,
			structure: course.structure,
			enrollmentCount: (course as any).enrollments?.length || 0,
		},
		currentUser: {
			id: currentUser.id,
			role: currentUser.role,
		},
		existingLinks,
		availableModules: availableModules.map((module) => ({
			id: module.id,
			title: module.title,
			type: module.type,
			status: module.status,
			description: module.description,
		})),
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
		return unauthorized({
			error: "Only admins and content managers can manage course links",
		});
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({ error: "Invalid course ID" });
	}

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "create") {
		const activityModuleId = Number(formData.get("activityModuleId"));
		if (Number.isNaN(activityModuleId)) {
			return badRequest({ error: "Invalid activity module ID" });
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			return badRequest({ error: "Failed to begin transaction" });
		}

		try {
			const createResult = await tryCreateCourseActivityModuleLink(
				payload,
				request,
				{
					course: courseId,
					activityModule: activityModuleId,
					transactionID,
				},
			);

			if (!createResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: createResult.error.message });
			}

			await payload.db.commitTransaction(transactionID);
			return ok({
				success: true,
				message: "Activity module linked successfully",
			});
		} catch {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "Failed to create link" });
		}
	}

	if (intent === "delete") {
		const linkId = Number(formData.get("linkId"));
		if (Number.isNaN(linkId)) {
			return badRequest({ error: "Invalid link ID" });
		}

		const deleteResult = await tryDeleteCourseActivityModuleLink(
			payload,
			request,
			linkId,
		);

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Link deleted successfully" });
	}

	return badRequest({ error: "Invalid intent" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
	const fetcher = useFetcher<typeof action>();
	const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

	if ("error" in loaderData) {
		return (
			<Container size="lg" py="xl">
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="red">{loaderData.error}</Text>
				</Paper>
			</Container>
		);
	}

	const { course, currentUser, existingLinks, availableModules } = loaderData;

	const getStatusBadgeColor = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "green";
			case "draft":
				return "yellow";
			case "archived":
				return "gray";
			default:
				return "gray";
		}
	};

	const getStatusLabel = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "Published";
			case "draft":
				return "Draft";
			case "archived":
				return "Archived";
			default:
				return status;
		}
	};

	const getTypeLabel = (type: string) => {
		switch (type) {
			case "page":
				return "Page";
			case "whiteboard":
				return "Whiteboard";
			case "assignment":
				return "Assignment";
			case "quiz":
				return "Quiz";
			case "discussion":
				return "Discussion";
			default:
				return type;
		}
	};

	const canEdit =
		currentUser.role === "admin" || currentUser.id === course.createdById;

	const handleDeleteLink = (linkId: number) => {
		fetcher.submit(
			{ intent: "delete", linkId: linkId.toString() },
			{ method: "post" },
		);
	};

	const handleCreateLink = (activityModuleId: number) => {
		fetcher.submit(
			{ intent: "create", activityModuleId: activityModuleId.toString() },
			{ method: "post" },
		);
	};

	const handleAddModule = () => {
		if (selectedModuleId) {
			handleCreateLink(Number.parseInt(selectedModuleId, 10));
			setSelectedModuleId(null); // Reset selection after adding
		}
	};

	return (
		<Container size="lg" py="xl">
			<title>{`${course.title} | Paideia LMS`}</title>
			<meta name="description" content={course.description} />
			<meta property="og:title" content={`${course.title} | Paideia LMS`} />
			<meta property="og:description" content={course.description} />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Group gap="sm" mb="xs">
							<Title order={1}>{course.title}</Title>
							<Badge color={getStatusBadgeColor(course.status)} size="lg">
								{getStatusLabel(course.status)}
							</Badge>
						</Group>
						<Text c="dimmed" size="sm">
							{course.slug}
						</Text>
					</div>
					{canEdit && (
						<Button
							component={Link}
							to={`/course/edit/${course.id}`}
							leftSection={<IconEdit size={16} />}
						>
							Edit Course
						</Button>
					)}
				</Group>

				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Stack gap="xl">
						<div>
							<Text fw={600} size="sm" c="dimmed" mb="xs">
								Description
							</Text>
							<Text>{course.description}</Text>
						</div>

						<Group grow>
							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Created By
								</Text>
								<Text>{course.createdBy}</Text>
							</Card>

							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Enrollments
								</Text>
								<Text>{course.enrollmentCount}</Text>
							</Card>

							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Created
								</Text>
								<Text>{new Date(course.createdAt).toLocaleDateString()}</Text>
							</Card>

							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Updated
								</Text>
								<Text>{new Date(course.updatedAt).toLocaleDateString()}</Text>
							</Card>
						</Group>

						<div>
							<Text fw={600} size="sm" c="dimmed" mb="xs">
								Course Structure
							</Text>
							<Box
								p="md"
								style={{
									backgroundColor: "var(--mantine-color-gray-0)",
									borderRadius: "var(--mantine-radius-sm)",
								}}
							>
								<pre style={{ margin: 0, overflow: "auto" }}>
									{JSON.stringify(course.structure, null, 2)}
								</pre>
							</Box>
						</div>
					</Stack>
				</Paper>

				{/* Activity Module Links Section */}
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Stack gap="lg">
						<Group justify="space-between">
							<Title order={2}>Linked Activity Modules</Title>
							{canEdit && (
								<Group gap="sm">
									{availableModules.length > 0 ? (
										<>
											<Select
												placeholder="Select activity module"
												data={availableModules.map((module) => ({
													value: module.id.toString(),
													label: `${module.title} (${getTypeLabel(module.type)})`,
												}))}
												value={selectedModuleId}
												onChange={setSelectedModuleId}
												disabled={fetcher.state === "submitting"}
												style={{ minWidth: 300 }}
											/>
											<Button
												leftSection={<IconPlus size={16} />}
												onClick={handleAddModule}
												disabled={
													fetcher.state === "submitting" || !selectedModuleId
												}
											>
												Add Module
											</Button>
										</>
									) : (
										<Text size="sm" c="dimmed">
											No available modules to link
										</Text>
									)}
								</Group>
							)}
						</Group>

						{existingLinks.length === 0 ? (
							<Text c="dimmed" ta="center" py="xl">
								No activity modules linked to this course yet.
							</Text>
						) : (
							<Box style={{ overflowX: "auto" }}>
								<Table striped highlightOnHover>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Module Title</Table.Th>
											<Table.Th>Type</Table.Th>
											<Table.Th>Status</Table.Th>
											<Table.Th>Created Date</Table.Th>
											{canEdit && <Table.Th>Actions</Table.Th>}
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{existingLinks.map((link) => (
											<Table.Tr key={link.id}>
												<Table.Td>
													<Text fw={500}>
														{typeof link.activityModule === "object"
															? link.activityModule.title
															: "Unknown Module"}
													</Text>
												</Table.Td>
												<Table.Td>
													<Badge variant="light">
														{typeof link.activityModule === "object"
															? getTypeLabel(link.activityModule.type)
															: "Unknown"}
													</Badge>
												</Table.Td>
												<Table.Td>
													<Badge
														color={
															typeof link.activityModule === "object"
																? getStatusBadgeColor(
																		link.activityModule.status,
																	)
																: "gray"
														}
													>
														{typeof link.activityModule === "object"
															? getStatusLabel(link.activityModule.status)
															: "Unknown"}
													</Badge>
												</Table.Td>
												<Table.Td>
													<Text size="sm" c="dimmed">
														{new Date(link.createdAt).toLocaleDateString()}
													</Text>
												</Table.Td>
												{canEdit && (
													<Table.Td>
														<ActionIcon
															variant="light"
															color="red"
															size="md"
															aria-label="Delete link"
															onClick={() => handleDeleteLink(link.id)}
															disabled={fetcher.state === "submitting"}
														>
															<IconTrash size={16} />
														</ActionIcon>
													</Table.Td>
												)}
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</Box>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
