import {
	Alert,
	Badge,
	Box,
	Code,
	Container,
	Group,
	Paper,
	Progress,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { href } from "react-router";
import { useRevalidator } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetLatestVersion } from "server/internal/version-management";
import { detectSystemResources } from "server/utils/bun-system-resources";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/system";

export function getRouteUrl() {
	return href("/admin/system");
}

function getServerTimezone() {
	return (
		Intl.DateTimeFormat().resolvedOptions().timeZone ||
		process.env.TZ ||
		"Unknown"
	);
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view system information");
	}

	// Get platform info and Bun version from global context (static, detected at startup)
	const { platformInfo, bunVersion, bunRevision, packageVersion } =
		context.get(globalContextKey);

	// Detect system resources (dynamic, needs to be refreshed)
	const systemResources = await detectSystemResources();

	// Get server timezone
	const serverTimezone = getServerTimezone();

	// Check for latest version from Docker Hub
	const versionInfo = await tryGetLatestVersion({
		payload: context.get(globalContextKey).payload,
		currentVersion: packageVersion,
	}).getOrNull();

	return {
		platformInfo,
		systemResources,
		bunVersion,
		bunRevision,
		packageVersion,
		serverTimezone,
		versionInfo,
	};
};

// Type definitions for client-side use
type PlatformDetectionResult = {
	detected: boolean;
	platform: string;
	confidence: "high" | "medium" | "low";
	info: {
		platform: string;
		region?: string;
		instanceId?: string;
		appName?: string;
		version?: string;
		metadata: Record<string, string>;
	};
};

type SystemResources = {
	memory: {
		total: number;
		available: number;
		used: number;
		percentage: number;
	};
	cpu: {
		cores: number;
		model?: string;
		architecture: string;
		usage?: number;
	};
	disk?: {
		total: number;
		available: number;
		used: number;
		percentage: number;
	} | null;
	os: {
		platform: string;
		distribution?: string;
		version?: string;
		codename?: string;
	};
	uptime: number;
	loadAverage?: number[];
};

// Utility functions for client-side use
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getResourceStatus(percentage: number): "good" | "warning" | "error" {
	if (percentage < 70) return "good";
	if (percentage < 85) return "warning";
	return "error";
}

function PlatformInfoSection({
	platformInfo,
}: {
	platformInfo: PlatformDetectionResult;
}) {
	const getConfidenceBadgeColor = (
		confidence: "high" | "medium" | "low",
	): string => {
		switch (confidence) {
			case "high":
				return "green";
			case "medium":
				return "yellow";
			case "low":
				return "red";
			default:
				return "gray";
		}
	};

	return (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={2}>Platform Detection</Title>
					<Group gap="xs">
						<Badge color={platformInfo.detected ? "green" : "red"}>
							{platformInfo.detected ? "Detected" : "Not Detected"}
						</Badge>
						<Badge color={getConfidenceBadgeColor(platformInfo.confidence)}>
							{platformInfo.confidence} confidence
						</Badge>
					</Group>
				</Group>

				<Box>
					<Text size="sm" fw={500} c="dimmed">
						Platform
					</Text>
					<Text size="lg" fw={600}>
						{platformInfo.platform}
					</Text>
				</Box>

				{platformInfo.info.region && (
					<Box>
						<Text size="sm" fw={500} c="dimmed">
							Region
						</Text>
						<Text>{platformInfo.info.region}</Text>
					</Box>
				)}

				{platformInfo.info.instanceId && (
					<Box>
						<Text size="sm" fw={500} c="dimmed">
							Instance ID
						</Text>
						<Text>{platformInfo.info.instanceId}</Text>
					</Box>
				)}

				{platformInfo.info.appName && (
					<Box>
						<Text size="sm" fw={500} c="dimmed">
							App Name
						</Text>
						<Text>{platformInfo.info.appName}</Text>
					</Box>
				)}

				{platformInfo.info.version && (
					<Box>
						<Text size="sm" fw={500} c="dimmed">
							Version
						</Text>
						<Text>{platformInfo.info.version}</Text>
					</Box>
				)}

				{Object.keys(platformInfo.info.metadata).length > 0 && (
					<Box>
						<Text size="sm" fw={500} c="dimmed" mb="xs">
							Metadata
						</Text>
						<Stack gap="xs">
							{Object.entries(platformInfo.info.metadata)
								.filter(([_, value]) => value)
								.slice(0, 5)
								.map(([key, value]) => (
									<Group key={key} gap="xs">
										<Text size="sm" c="dimmed">
											{key}:
										</Text>
										<Text size="sm">{value}</Text>
									</Group>
								))}
						</Stack>
					</Box>
				)}
			</Stack>
		</Paper>
	);
}

function SystemResourcesSection({
	systemResources,
	serverTimezone,
}: {
	systemResources: SystemResources;
	serverTimezone: string;
}) {
	const memoryStatus = getResourceStatus(systemResources.memory.percentage);
	const diskStatus = systemResources.disk
		? getResourceStatus(systemResources.disk.percentage)
		: "good";

	const getStatusColor = (status: "good" | "warning" | "error"): string => {
		switch (status) {
			case "good":
				return "green";
			case "warning":
				return "yellow";
			case "error":
				return "red";
			default:
				return "gray";
		}
	};

	const formatUptime = (seconds: number): string => {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		const parts = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);
		if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

		return parts.join(" ");
	};

	return (
		<Paper withBorder shadow="sm" p="md" radius="md">
			<Stack gap="md">
				<Title order={2}>System Resources</Title>

				{/* Memory */}
				<Box>
					<Group justify="space-between" mb="xs">
						<Text size="sm" fw={500}>
							Memory
						</Text>
						<Badge color={getStatusColor(memoryStatus)}>
							{systemResources.memory.percentage.toFixed(1)}% used
						</Badge>
					</Group>
					<Progress
						value={systemResources.memory.percentage}
						color={getStatusColor(memoryStatus)}
						size="lg"
						mb="xs"
					/>
					<Group gap="xl">
						<Box>
							<Text size="xs" c="dimmed">
								Total
							</Text>
							<Text size="sm" fw={500}>
								{formatBytes(systemResources.memory.total)}
							</Text>
						</Box>
						<Box>
							<Text size="xs" c="dimmed">
								Used
							</Text>
							<Text size="sm" fw={500}>
								{formatBytes(systemResources.memory.used)}
							</Text>
						</Box>
						<Box>
							<Text size="xs" c="dimmed">
								Available
							</Text>
							<Text size="sm" fw={500}>
								{formatBytes(systemResources.memory.available)}
							</Text>
						</Box>
					</Group>
				</Box>

				{/* CPU */}
				<Box>
					<Text size="sm" fw={500} mb="xs">
						CPU
					</Text>
					<Group gap="xl">
						<Box>
							<Text size="xs" c="dimmed">
								Cores
							</Text>
							<Text size="sm" fw={500}>
								{systemResources.cpu.cores}
							</Text>
						</Box>
						<Box>
							<Text size="xs" c="dimmed">
								Architecture
							</Text>
							<Text size="sm" fw={500}>
								{systemResources.cpu.architecture}
							</Text>
						</Box>
						{systemResources.cpu.model && (
							<Box>
								<Text size="xs" c="dimmed">
									Model
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.cpu.model}
								</Text>
							</Box>
						)}
					</Group>
				</Box>

				{/* Disk */}
				{systemResources.disk && (
					<Box>
						<Group justify="space-between" mb="xs">
							<Text size="sm" fw={500}>
								Disk
							</Text>
							<Badge color={getStatusColor(diskStatus)}>
								{systemResources.disk.percentage.toFixed(1)}% used
							</Badge>
						</Group>
						<Progress
							value={systemResources.disk.percentage}
							color={getStatusColor(diskStatus)}
							size="lg"
							mb="xs"
						/>
						<Group gap="xl">
							<Box>
								<Text size="xs" c="dimmed">
									Total
								</Text>
								<Text size="sm" fw={500}>
									{formatBytes(systemResources.disk.total)}
								</Text>
							</Box>
							<Box>
								<Text size="xs" c="dimmed">
									Used
								</Text>
								<Text size="sm" fw={500}>
									{formatBytes(systemResources.disk.used)}
								</Text>
							</Box>
							<Box>
								<Text size="xs" c="dimmed">
									Available
								</Text>
								<Text size="sm" fw={500}>
									{formatBytes(systemResources.disk.available)}
								</Text>
							</Box>
						</Group>
					</Box>
				)}

				{/* OS */}
				<Box>
					<Text size="sm" fw={500} mb="xs">
						Operating System
					</Text>
					<Group gap="xl">
						<Box>
							<Text size="xs" c="dimmed">
								Platform
							</Text>
							<Text size="sm" fw={500}>
								{systemResources.os.platform}
							</Text>
						</Box>
						{systemResources.os.distribution && (
							<Box>
								<Text size="xs" c="dimmed">
									Distribution
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.os.distribution}
								</Text>
							</Box>
						)}
						{systemResources.os.version && (
							<Box>
								<Text size="xs" c="dimmed">
									Version
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.os.version}
								</Text>
							</Box>
						)}
						{systemResources.os.codename && (
							<Box>
								<Text size="xs" c="dimmed">
									Codename
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.os.codename}
								</Text>
							</Box>
						)}
					</Group>
				</Box>

				{/* Server Timezone */}
				<Box>
					<Text size="sm" fw={500} c="dimmed">
						Server Timezone
					</Text>
					<Text size="lg" fw={600}>
						{serverTimezone}
					</Text>
				</Box>

				{/* Uptime */}
				<Box>
					<Text size="sm" fw={500} c="dimmed">
						Uptime
					</Text>
					<Text size="lg" fw={600}>
						{formatUptime(systemResources.uptime)}
					</Text>
				</Box>

				{/* Load Average */}
				{systemResources.loadAverage && (
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Load Average
						</Text>
						<Group gap="xl">
							<Box>
								<Text size="xs" c="dimmed">
									1 min
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.loadAverage[0]?.toFixed(2)}
								</Text>
							</Box>
							<Box>
								<Text size="xs" c="dimmed">
									5 min
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.loadAverage[1]?.toFixed(2)}
								</Text>
							</Box>
							<Box>
								<Text size="xs" c="dimmed">
									15 min
								</Text>
								<Text size="sm" fw={500}>
									{systemResources.loadAverage[2]?.toFixed(2)}
								</Text>
							</Box>
						</Group>
					</Box>
				)}
			</Stack>
		</Paper>
	);
}

export default function SystemPage({ loaderData }: Route.ComponentProps) {
	const {
		platformInfo,
		systemResources,
		bunVersion,
		bunRevision,
		packageVersion,
		serverTimezone,
		versionInfo,
	} = loaderData;
	const revalidator = useRevalidator();

	useInterval(
		() => {
			revalidator.revalidate();
		},
		1000,
		{ autoInvoke: true },
	);

	// const isRevalidating = revalidator.state === "loading";

	return (
		<Container size="xl" py="xl">
			<title>System Information | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="View system and platform information for Paideia LMS"
			/>
			<meta
				property="og:title"
				content="System Information | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="View system and platform information for Paideia LMS"
			/>

			<Stack gap="lg">
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={1}>System Information</Title>
						<Text c="dimmed" size="sm">
							View platform detection and system resource information
						</Text>
					</div>
					{/* {isRevalidating && (
						<Badge color="green" variant="light">
							Refreshing...
						</Badge>
					)} */}
				</Group>

				{versionInfo?.isUpdateAvailable && (
					<Alert
						title="Update Available"
						color="blue"
						variant="light"
						radius="md"
					>
						<Stack gap="xs">
							<Text size="sm">
								A newer version of Paideia LMS is available. Current version:{" "}
								<Code>{packageVersion}</Code>, Latest version:{" "}
								<Code>{versionInfo.latestVersion}</Code>
							</Text>
							<Box>
								<Text size="sm" fw={500} mb="xs">
									To update:
								</Text>
								<Stack gap="xs">
									<Text size="sm" component="div">
										<strong>Docker users:</strong>
									</Text>
									<Code block>
										docker compose pull{`\n`}
										docker compose up -d{`\n`}
										docker image prune -f
									</Code>
									<Text size="sm" component="div" mt="xs">
										<strong>Other deployments:</strong> Please check{" "}
										<a
											href="https://docs.paideialms.com/en/upgrade/"
											target="_blank"
											rel="noopener noreferrer"
										>
											https://docs.paideialms.com/en/upgrade/
										</a>
									</Text>
								</Stack>
							</Box>
						</Stack>
					</Alert>
				)}

				{versionInfo && !versionInfo.isUpdateAvailable && (
					<Alert title="Up to Date" color="green" variant="light" radius="md">
						<Text size="sm">
							You are running the latest version of Paideia LMS (
							<Code>{packageVersion}</Code>).
						</Text>
					</Alert>
				)}

				<PlatformInfoSection platformInfo={platformInfo} />
				<SystemResourcesSection
					systemResources={systemResources}
					serverTimezone={serverTimezone}
				/>

				<Paper withBorder shadow="sm" p="md" radius="md">
					<Stack gap="md">
						<Title order={2}>Bun Runtime</Title>
						<Group gap="xl">
							<Box>
								<Text size="xs" c="dimmed">
									Version
								</Text>
								<Text size="sm" fw={500}>
									{bunVersion}
								</Text>
							</Box>
							<Box>
								<Text size="xs" c="dimmed">
									Revision
								</Text>
								<Text size="sm" fw={500} style={{ fontFamily: "monospace" }}>
									{bunRevision}
								</Text>
							</Box>
						</Group>
					</Stack>
				</Paper>

				<Paper withBorder shadow="sm" p="md" radius="md">
					<Stack gap="md">
						<Group justify="space-between">
							<Title order={2}>Application</Title>
							{versionInfo && !versionInfo.isUpdateAvailable && (
								<Badge color="green" variant="light">
									Latest
								</Badge>
							)}
						</Group>
						<Box>
							<Text size="xs" c="dimmed">
								Version
							</Text>
							<Text size="sm" fw={500}>
								{packageVersion}
							</Text>
						</Box>
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
