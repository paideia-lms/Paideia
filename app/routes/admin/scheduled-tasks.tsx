import {
	Badge,
	Box,
	Container,
	Paper,
	Stack,
	Table,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useRevalidator } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetScheduledTasks } from "server/internal/scheduled-tasks-management";
import {
	ForbiddenResponse,
	InternalServerErrorResponse,
} from "~/utils/responses";
import { typeCreateLoader } from "app/utils/loader-utils";
import type { Route } from "./+types/scheduled-tasks";
import { href } from "react-router";

export function getRouteUrl() {
	return href("/admin/scheduled-tasks");
}

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view scheduled tasks");
	}

	const scheduledTasksResult = await tryGetScheduledTasks(payload);

	if (!scheduledTasksResult.ok) {
		throw new InternalServerErrorResponse(
			`Failed to get scheduled tasks: ${scheduledTasksResult.error.message}`,
		);
	}

	return scheduledTasksResult.value;
});

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

function getStatusBadge(status: string) {
	switch (status) {
		case "pending":
			return (
				<Tooltip label="Task is waiting for its scheduled execution time">
					<Badge color="blue">Pending</Badge>
				</Tooltip>
			);
		case "processing":
			return (
				<Tooltip label="Task is currently being executed">
					<Badge color="yellow">Processing</Badge>
				</Tooltip>
			);
		case "completed":
			return (
				<Tooltip label="Task has been successfully completed">
					<Badge color="green">Completed</Badge>
				</Tooltip>
			);
		case "failed":
			return (
				<Tooltip label="Task failed during execution. Check error details for more information">
					<Badge color="red">Failed</Badge>
				</Tooltip>
			);
		case "expired":
			return (
				<Tooltip label="Task's scheduled time has passed but it hasn't been executed yet. It may be waiting to be picked up by the job processor">
					<Badge color="orange">Expired</Badge>
				</Tooltip>
			);
		default:
			return <Badge color="gray">{status}</Badge>;
	}
}

function formatDateString(dateString: string | null): string {
	if (!dateString) return "-";
	try {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "medium",
		}).format(date);
	} catch {
		return dateString;
	}
}

function getTaskName(taskSlug: string | null): string {
	if (!taskSlug) return "Unknown";
	if (taskSlug === "autoSubmitQuiz") {
		return "Auto Submit Quiz";
	}
	if (taskSlug === "sandboxReset") {
		return "Sandbox Reset";
	}
	return `Task: ${taskSlug}`;
}

export default function ScheduledTasksPage({
	loaderData,
}: Route.ComponentProps) {
	const {
		scheduledTasks,
		totalPending,
		totalProcessing,
		totalCompleted,
		totalFailed,
		totalExpired,
	} = loaderData;
	const revalidator = useRevalidator();

	useInterval(
		() => {
			revalidator.revalidate();
		},
		1000,
		{ autoInvoke: true },
	);

	const rows = scheduledTasks.map((task) => (
		<Table.Tr key={task.id}>
			<Table.Td>
				<Text size="sm" fw={500}>
					{getTaskName(task.taskSlug)}
				</Text>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{task.taskSlug || "-"}</Text>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{task.queue || "-"}</Text>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{formatDateString(task.waitUntil)}</Text>
			</Table.Td>
			<Table.Td>{getStatusBadge(task.status)}</Table.Td>
			<Table.Td>
				<Text size="sm">{formatDateString(task.createdAt)}</Text>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{formatDateString(task.completedAt)}</Text>
			</Table.Td>
		</Table.Tr>
	));

	return (
		<Container size="xl" py="xl">
			<title>Scheduled Tasks | Site Administration | Paideia LMS</title>
			<meta
				name="description"
				content="View and manage scheduled tasks and jobs"
			/>
			<meta
				property="og:title"
				content="Scheduled Tasks | Site Administration | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="View and manage scheduled tasks and jobs"
			/>

			<Stack gap="lg">
				<div>
					<Title order={1}>Scheduled Tasks</Title>
					<Text c="dimmed" size="sm" mt="xs">
						One-time jobs scheduled for specific execution times
					</Text>
				</div>

				{/* Statistics */}
				<Paper p="md" withBorder>
					<Stack gap="sm">
						<Title order={3} size="h4">
							Statistics
						</Title>
						<Box style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
							<Tooltip label="Tasks waiting for their scheduled execution time">
								<Badge color="blue" size="lg">
									Pending: {totalPending}
								</Badge>
							</Tooltip>
							<Tooltip label="Tasks currently being executed">
								<Badge color="yellow" size="lg">
									Processing: {totalProcessing}
								</Badge>
							</Tooltip>
							<Tooltip label="Tasks that have been successfully completed">
								<Badge color="green" size="lg">
									Completed: {totalCompleted}
								</Badge>
							</Tooltip>
							<Tooltip label="Tasks that failed during execution">
								<Badge color="red" size="lg">
									Failed: {totalFailed}
								</Badge>
							</Tooltip>
							<Tooltip label="Tasks whose scheduled time has passed but haven't been executed yet">
								<Badge color="orange" size="lg">
									Expired: {totalExpired}
								</Badge>
							</Tooltip>
						</Box>
					</Stack>
				</Paper>

				{/* Scheduled Tasks Table */}
				<Paper p="md" withBorder>
					{scheduledTasks.length > 0 ? (
						<Table>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Task Name</Table.Th>
									<Table.Th>Task Slug</Table.Th>
									<Table.Th>Queue</Table.Th>
									<Table.Th>Scheduled For</Table.Th>
									<Table.Th>Status</Table.Th>
									<Table.Th>Created At</Table.Th>
									<Table.Th>Completed At</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>{rows}</Table.Tbody>
						</Table>
					) : (
						<Box p="md" style={{ textAlign: "center" }}>
							<Text c="dimmed">No scheduled tasks found</Text>
						</Box>
					)}
				</Paper>
			</Stack>
		</Container>
	);
}
