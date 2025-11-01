import { Alert, Badge, Box, Paper, Stack, Table, Title } from "@mantine/core";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	isD2Available,
	isPgDumpAvailable,
} from "server/utils/cli-dependencies-check";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/dependencies";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view dependencies");
	}

	// Check all dependencies
	const [d2Available, pgDumpAvailable] = await Promise.all([
		isD2Available(),
		isPgDumpAvailable(),
	]);

	return {
		dependencies: [
			{
				name: "D2 CLI",
				description: "Required for rendering D2 diagrams to SVG",
				available: d2Available,
				installationLink: "https://d2lang.com/install",
			},
			{
				name: "pg_dump",
				description: "Required for database backup functionality",
				available: pgDumpAvailable,
				installationLink: "https://www.postgresql.org/download/",
			},
		],
	};
};

export default function DependenciesPage({ loaderData }: Route.ComponentProps) {
	const { dependencies } = loaderData;

	const rows = dependencies.map((dep) => (
		<Table.Tr key={dep.name}>
			<Table.Td>{dep.name}</Table.Td>
			<Table.Td>{dep.description}</Table.Td>
			<Table.Td>
				{dep.available ? (
					<Badge color="green">Available</Badge>
				) : (
					<Badge color="red">Not Available</Badge>
				)}
			</Table.Td>
		</Table.Tr>
	));

	const allAvailable = dependencies.every((dep) => dep.available);
	const missingDependencies = dependencies.filter((dep) => !dep.available);

	return (
		<Box pt="xl">
			<title>CLI Dependencies | Paideia LMS</title>
			<meta
				name="description"
				content="Check CLI dependencies status in Paideia LMS"
			/>
			<meta property="og:title" content="CLI Dependencies | Paideia LMS" />
			<meta
				property="og:description"
				content="Check CLI dependencies status in Paideia LMS"
			/>

			<Stack gap="lg">
				<Title order={1}>CLI Dependencies</Title>

				{!allAvailable && (
					<Alert variant="light" color="yellow" title="Missing Dependencies">
						<Stack gap="xs">
							<div>
								The following CLI tools are not available but may be required
								for certain features:
							</div>
							<ul>
								{missingDependencies.map((dep) => (
									<li key={dep.name}>
										<strong>{dep.name}</strong>: {dep.description}
										{dep.installationLink && (
											<>
												{" "}
												(
												<a
													href={dep.installationLink}
													target="_blank"
													rel="noopener noreferrer"
												>
													Installation guide
												</a>
												)
											</>
										)}
									</li>
								))}
							</ul>
						</Stack>
					</Alert>
				)}

				<Alert variant="light" color="blue" title="About CLI Dependencies">
					<Stack gap="xs">
						<div>
							Some features in Paideia LMS require external CLI tools to be
							installed on the server. This page shows the availability of these
							tools.
						</div>
						<div>
							<strong>Note:</strong> If a dependency is not available, the
							related features will be disabled or show error messages.
						</div>
					</Stack>
				</Alert>

				<Paper p="md" withBorder>
					<Table>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Tool</Table.Th>
								<Table.Th>Description</Table.Th>
								<Table.Th>Status</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{rows.length > 0 ? (
								rows
							) : (
								<Table.Tr>
									<Table.Td colSpan={3} style={{ textAlign: "center" }}>
										No dependencies found
									</Table.Td>
								</Table.Tr>
							)}
						</Table.Tbody>
					</Table>
				</Paper>
			</Stack>
		</Box>
	);
}
