import { Alert, Box, Container, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { href, isRouteErrorResponse, Link } from "react-router";
import { DefaultErrorBoundary } from "../components/default-error-boundary";

interface RootErrorBoundaryProps {
	error: unknown;
}

export function RootErrorBoundary({ error }: RootErrorBoundaryProps) {
	const isMaintenanceMode =
		isRouteErrorResponse(error) &&
		error.status === 503 &&
		error.statusText === "Service Unavailable";

	if (!isMaintenanceMode) {
		// If it's not a maintenance mode error, show default error boundary
		return <DefaultErrorBoundary error={error} />;
	}

	const message =
		typeof error.data === "string"
			? error.data
			: "The system is currently under maintenance. Please try again later.";

	return (
		<Container size="sm" py="xl">
			<Stack gap="lg" align="center">
				<IconAlertTriangle size={64} color="var(--mantine-color-orange-6)" />
				<Title order={1}>System Under Maintenance</Title>
				<Alert color="orange" variant="light" icon={<IconAlertTriangle />}>
					<Text>{message}</Text>
				</Alert>
				<Text c="dimmed" size="sm" ta="center">
					If you are an administrator, please log in to access the system.
				</Text>
				<Box component={Link} to={href("/login")}>
					<Text c="blue" td="underline">
						Go to Login
					</Text>
				</Box>
			</Stack>
		</Container>
	);
}
