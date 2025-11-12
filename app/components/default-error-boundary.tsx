import { Box, Code, Text, Title } from "@mantine/core";
import { isRouteErrorResponse } from "react-router";

interface DefaultErrorBoundaryProps {
	error: unknown;
}

export function DefaultErrorBoundary({ error }: DefaultErrorBoundaryProps) {
	return (
		<Box p="md">
			{isRouteErrorResponse(error) ? (
				<>
					<Title order={1} c="red">
						{error.status} {error.statusText}
					</Title>
					<Text>
						{typeof error.data === "string"
							? error.data
							: JSON.stringify(error.data)}
					</Text>
				</>
			) : error instanceof Error ? (
				// this is likely to be a client error, it should be ok to show the stack trace
				<>
					<Title order={1} c="red">
						Error
					</Title>
					<Text>{error.message}</Text>
					<Code block>{error.stack}</Code>
				</>
			) : (
				<Title order={1} c="red">
					Unknown Error
				</Title>
			)}
		</Box>
	);
}
