import { CodeHighlight } from "@mantine/code-highlight";
import { Badge, Box, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useRevalidator } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetCronJobs } from "server/internal/cron-jobs-management";
import {
	ForbiddenResponse,
	InternalServerErrorResponse,
} from "~/utils/responses";
import type { Route } from "./+types/cron-jobs";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view cron jobs");
	}

	const cronJobsResult = await tryGetCronJobs({ payload, req: payloadRequest });

	if (!cronJobsResult.ok) {
		throw new InternalServerErrorResponse(
			`Failed to get cron jobs: ${cronJobsResult.error.message}`,
		);
	}

	return cronJobsResult.value;
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

function getStatusBadge(isActive: boolean) {
	if (isActive) {
		return <Badge color="green">Active</Badge>;
	}
	return <Badge color="gray">Inactive</Badge>;
}

function formatDate(date: Date | null): string {
	if (!date) return "-";
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(date);
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

function getJobName(taskSlug: string | null, queue: string | null): string {
	if (taskSlug) {
		if (taskSlug === "sandboxReset") {
			return "Task: sandboxReset";
		}
		return `Task: ${taskSlug}`;
	}
	if (queue) {
		return `Queue: ${queue}`;
	}
	return "Unknown";
}

export default function CronJobsPage({ loaderData }: Route.ComponentProps) {
	const { cronJobs, cronEnabled, jobHistory } = loaderData;
	const revalidator = useRevalidator();

	useInterval(
		() => {
			revalidator.revalidate();
		},
		1000,
		{ autoInvoke: true },
	);

	const rows = cronJobs.map((job) => (
		<Table.Tr key={`${job.type}-${job.name}-${job.pattern}`}>
			<Table.Td>
				<Stack gap={2}>
					<Text fw={500}>{job.name}</Text>
					{job.description && (
						<Text size="xs" c="dimmed">
							{job.description}
						</Text>
					)}
				</Stack>
			</Table.Td>
			<Table.Td>
				<Text ff="monospace" size="sm" style={{ fontFamily: "monospace" }}>
					{job.pattern}
				</Text>
			</Table.Td>
			<Table.Td>
				<Badge variant="light" color={job.type === "task" ? "blue" : "gray"}>
					{job.type === "task" ? "Task" : "Queue"}
				</Badge>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{job.queue || "-"}</Text>
			</Table.Td>
			<Table.Td>{getStatusBadge(job.isActive)}</Table.Td>
			<Table.Td>
				<Text size="sm">{formatDate(job.nextRun)}</Text>
			</Table.Td>
			<Table.Td>
				<Text size="sm">{formatDate(job.previousRun)}</Text>
			</Table.Td>
		</Table.Tr>
	));

	return (
		<Box pt="xl">
			<title>Cron Jobs | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="View and monitor cron jobs in Paideia LMS"
			/>
			<meta property="og:title" content="Cron Jobs | Admin | Paideia LMS" />
			<meta
				property="og:description"
				content="View and monitor cron jobs in Paideia LMS"
			/>

			<Stack gap="lg">
				<div>
					<Title order={1}>Cron Jobs</Title>
					{!cronEnabled && (
						<Text c="orange" size="sm" mt="xs">
							Note: Cron jobs are currently disabled (cron: false). Jobs are
							configured but not running.
						</Text>
					)}
				</div>

				<Paper p="md" withBorder>
					{cronJobs.length > 0 ? (
						<Table>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Name</Table.Th>
									<Table.Th>Pattern</Table.Th>
									<Table.Th>Type</Table.Th>
									<Table.Th>Queue</Table.Th>
									<Table.Th>Status</Table.Th>
									<Table.Th>Next Run</Table.Th>
									<Table.Th>Previous Run</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>{rows}</Table.Tbody>
						</Table>
					) : (
						<Box p="md" style={{ textAlign: "center" }}>
							<Text c="dimmed">No cron jobs configured</Text>
						</Box>
					)}
				</Paper>

				<Paper p="md" withBorder>
					<Stack gap="md">
						<div>
							<Title order={2} size="h3">
								Job History
							</Title>
							<Text c="dimmed" size="sm" mt="xs">
								Recent execution history of cron jobs
							</Text>
						</div>

						{jobHistory.length > 0 ? (
							<Table>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Job</Table.Th>
										<Table.Th>Task Slug</Table.Th>
										<Table.Th>Queue</Table.Th>
										<Table.Th>Executed At</Table.Th>
										<Table.Th>Completed At</Table.Th>
										<Table.Th>State</Table.Th>
										<Table.Th>Error</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{jobHistory.map((entry) => (
										<Table.Tr key={entry.id}>
											<Table.Td>
												<Text size="sm">
													{getJobName(entry.taskSlug, entry.queue)}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{entry.taskSlug || "-"}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{entry.queue || "-"}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">
													{formatDateString(entry.executedAt)}
												</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">
													{formatDateString(entry.completedAt)}
												</Text>
											</Table.Td>
											<Table.Td>
												<Badge
													color={entry.state === "succeeded" ? "green" : "red"}
												>
													{entry.state === "succeeded" ? "Succeeded" : "Failed"}
												</Badge>
											</Table.Td>
											<Table.Td>
												{entry.error ? (
													<Box style={{ maxWidth: 500 }}>
														<CodeHighlight
															code={
																typeof entry.error === "string"
																	? entry.error
																	: JSON.stringify(entry.error, null, 2)
															}
															language={
																typeof entry.error === "string"
																	? "text"
																	: "json"
															}
															copyLabel="Copy error"
															copiedLabel="Copied!"
															radius="md"
														/>
													</Box>
												) : (
													<Text size="sm" c="dimmed">
														-
													</Text>
												)}
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						) : (
							<Box p="md" style={{ textAlign: "center" }}>
								<Text c="dimmed">No job history available</Text>
							</Box>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Box>
	);
}
