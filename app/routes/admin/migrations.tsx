import {
	Alert,
	Badge,
	Box,
	Button,
	Paper,
	Stack,
	Table,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Migration as MigrationType } from "payload";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { dumpDatabase } from "server/utils/db/dump";
import { getMigrationStatus } from "server/utils/db/migration-status";
import { migrations } from "src/migrations";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/migrations";

enum Action {
	Dump = "dump",
}

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/migrations",
});

const dumpRpc = createActionRpc({
	method: "POST",
	action: Action.Dump,
});

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
		throw new ForbiddenResponse("Only admins can view migrations");
	}

	const statuses = await getMigrationStatus({
		payload,
		migrations: migrations as MigrationType[],
	});

	return {
		statuses: statuses || [],
	};
});

const dumpAction = dumpRpc.createAction(async ({ context }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		return unauthorized({ error: "Only admins can dump database" });
	}

	const result = await dumpDatabase({ payload });

	if (!result.success) {
		return badRequest({ error: result.error || "Failed to dump database" });
	}

	return ok({
		success: true,
		message: `Database dump completed: ${result.outputPath}`,
		outputPath: result.outputPath,
	});
});

const useDumpPostgres = dumpRpc.createHook<typeof dumpAction>();

// Export hook for use in components
export { useDumpPostgres };

export const action = dumpAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

function DumpPostgresButton() {
	const { submit: dumpPostgres, isLoading } = useDumpPostgres();
	return (
		<Button
			onClick={() => dumpPostgres({ values: {} })}
			disabled={isLoading}
			loading={isLoading}
		>
			Dump Database
		</Button>
	);
}

export default function MigrationsPage({ loaderData }: Route.ComponentProps) {
	const { statuses } = loaderData;

	const rows = statuses.map((status) => (
		<Table.Tr key={status.Name}>
			<Table.Td>{status.Name}</Table.Td>
			<Table.Td>
				{status.Batch !== null ? (
					<Badge variant="light" color="blue">
						Batch {status.Batch}
					</Badge>
				) : (
					<Badge variant="light" color="gray">
						-
					</Badge>
				)}
			</Table.Td>
			<Table.Td>
				{status.Ran.toLowerCase() === "yes" ? (
					<Badge color="green">Ran</Badge>
				) : (
					<Badge color="red">Not Run</Badge>
				)}
			</Table.Td>
		</Table.Tr>
	));

	return (
		<Box pt="xl">
			<title>Database Migrations | Paideia LMS</title>
			<meta
				name="description"
				content="View database migration status in Paideia LMS"
			/>
			<meta property="og:title" content="Database Migrations | Paideia LMS" />
			<meta
				property="og:description"
				content="View database migration status in Paideia LMS"
			/>

			<Stack gap="lg">
				<Box
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<Title order={1}>Database Migrations</Title>
					<DumpPostgresButton />
				</Box>

				<Alert variant="light" color="blue" title="About Migrations">
					<Stack gap="xs">
						<div>
							You don't need to worry about migrations. Migrations are
							automatically applied when the server starts.
						</div>
						<div>
							<strong>Important:</strong> Migrations cannot be performed through
							the UI. Only server administrators with server access can perform
							migrations, and they must be done through the Paideia CLI.
						</div>
						<div>
							<strong>CLI Commands:</strong>
							<ul style={{ marginTop: "0.5rem", marginBottom: 0 }}>
								<li>
									<code>paideia migrate up</code> - Executes all unapplied
									migrations to update the database schema
								</li>
								<li>
									<code>paideia migrate fresh</code> - Drops all database
									entities and re-runs all migrations from scratch
								</li>
							</ul>
						</div>
					</Stack>
				</Alert>

				<Paper p="md" withBorder>
					<Table>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Migration Name</Table.Th>
								<Table.Th>Batch</Table.Th>
								<Table.Th>Status</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{rows.length > 0 ? (
								rows
							) : (
								<Table.Tr>
									<Table.Td colSpan={3} style={{ textAlign: "center" }}>
										No migrations found
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
