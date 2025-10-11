import {
	Avatar,
	Badge,
	Box,
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryFindAllUsers } from "server/internal/user-management";
import type { User } from "server/payload-types";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/users";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view users");
	}

	// Fetch all users using tryFindAllUsers
	const usersResult = await tryFindAllUsers({
		payload,
		limit: 100,
		sort: "-createdAt",
		user: currentUser,
		overrideAccess: false,
	});

	if (!usersResult.ok) {
		return badRequest({
			users: [],
			totalUsers: 0,
			error: usersResult.error.message,
		});
	}

	const users = usersResult.value.docs.map((user) => {
		let avatarUrl: string | null = null;
		if (user.avatar) {
			if (typeof user.avatar === "object" && user.avatar.filename) {
				avatarUrl = href(`/api/media/file/:filename`, {
					filename: user.avatar.filename,
				});
			}
		}

		return {
			id: user.id,
			email: user.email,
			firstName: user.firstName ?? "",
			lastName: user.lastName ?? "",
			role: user.role,
			avatarUrl,
			createdAt: user.createdAt,
		};
	});

	return {
		users,
		totalUsers: usersResult.value.totalDocs,
	};
};

export default function UsersPage({ loaderData }: Route.ComponentProps) {
	const { users, totalUsers } = loaderData;
	const [searchQuery, setSearchQuery] = useState("");

	const filteredUsers = users.filter((user) => {
		const searchLower = searchQuery.toLowerCase();
		const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
		return (
			fullName.includes(searchLower) ||
			user.email.toLowerCase().includes(searchLower)
		);
	});

	const getRoleBadgeColor = (role: User["role"]) => {
		switch (role) {
			case "admin":
				return "red";
			case "content-manager":
				return "blue";
			case "analytics-viewer":
				return "green";
			default:
				return "gray";
		}
	};

	const getRoleLabel = (role: User["role"]) => {
		switch (role) {
			case "admin":
				return "Admin";
			case "content-manager":
				return "Content Manager";
			case "analytics-viewer":
				return "Analytics Viewer";
			default:
				return "User";
		}
	};

	return (
		<Container size="xl" py="xl">
			<title>Users | Admin | Paideia LMS</title>
			<meta name="description" content="Manage users in Paideia LMS" />
			<meta property="og:title" content="Users | Admin | Paideia LMS" />
			<meta property="og:description" content="Manage users in Paideia LMS" />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Title order={1}>Users</Title>
						<Text c="dimmed" size="sm">
							Manage all users in the system ({totalUsers} total)
						</Text>
					</div>
					<Button
						component={Link}
						to="/admin/user/new"
						leftSection={<IconPlus size={16} />}
					>
						Add User
					</Button>
				</Group>

				<Paper withBorder shadow="sm" p="md" radius="md">
					<TextInput
						placeholder="Search by name or email..."
						leftSection={<IconSearch size={16} />}
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.currentTarget.value)}
						mb="md"
					/>

					<Box style={{ overflowX: "auto" }}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>User</Table.Th>
									<Table.Th>Email</Table.Th>
									<Table.Th>Role</Table.Th>
									<Table.Th>Created</Table.Th>
									<Table.Th>Actions</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{filteredUsers.length === 0 ? (
									<Table.Tr>
										<Table.Td colSpan={5}>
											<Text ta="center" c="dimmed" py="xl">
												No users found
											</Text>
										</Table.Td>
									</Table.Tr>
								) : (
									filteredUsers.map((user) => (
										<Table.Tr key={user.id}>
											<Table.Td>
												<Group gap="sm">
													<Avatar
														src={user.avatarUrl}
														alt={`${user.firstName} ${user.lastName}`}
														size={32}
														radius="xl"
													/>
													<div>
														<Text size="sm" fw={500}>
															{user.firstName} {user.lastName}
														</Text>
													</div>
												</Group>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{user.email}</Text>
											</Table.Td>
											<Table.Td>
												<Badge color={getRoleBadgeColor(user.role)} size="sm">
													{getRoleLabel(user.role)}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed">
													{new Date(user.createdAt).toLocaleDateString()}
												</Text>
											</Table.Td>
											<Table.Td>
												<Group gap="xs">
													<Button
														component={Link}
														to={`/user/profile?id=${user.id}`}
														size="xs"
														variant="light"
													>
														View
													</Button>
												</Group>
											</Table.Td>
										</Table.Tr>
									))
								)}
							</Table.Tbody>
						</Table>
					</Box>
				</Paper>
			</Stack>
		</Container>
	);
}
