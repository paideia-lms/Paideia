import {
	Avatar,
	Badge,
	Box,
	Button,
	Container,
	Group,
	Pagination,
	Paper,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useEffect, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindAllUsers } from "server/internal/user-management";
import type { User } from "server/payload-types";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/users";

// Define search params
export const usersSearchParams = {
	query: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(usersSearchParams);

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (userSession.authenticatedUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view users");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Get search params from URL
	const { query, page } = loadSearchParams(request);

	// Fetch users with search and pagination
	const usersResult = await tryFindAllUsers({
		payload,
		query: query || undefined,
		limit: 10,
		page,
		sort: "-createdAt",
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!usersResult.ok) {
		return badRequest({
			users: [],
			totalUsers: 0,
			totalPages: 0,
			currentPage: 1,
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
		totalPages: usersResult.value.totalPages,
		currentPage: usersResult.value.page,
	};
};

export default function UsersPage({ loaderData }: Route.ComponentProps) {
	const { users, totalUsers, totalPages, currentPage } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();

	// Get current query from URL
	const urlQuery = searchParams.get("query") || "";

	// Local search state for immediate UI updates
	const [searchQuery, setSearchQuery] = useState(urlQuery);

	// Debounce the search query
	const [debouncedQuery] = useDebouncedValue(searchQuery, 500);

	// Update URL when debounced query changes
	useEffect(() => {
		const newParams = new URLSearchParams(searchParams);
		if (debouncedQuery) {
			newParams.set("query", debouncedQuery);
		} else {
			newParams.delete("query");
		}
		// Reset to page 1 when search changes
		newParams.set("page", "1");
		setSearchParams(newParams, { replace: true });
	}, [debouncedQuery, searchParams, setSearchParams]);

	// Handle page change
	const handlePageChange = (page: number) => {
		const newParams = new URLSearchParams(searchParams);
		newParams.set("page", page.toString());
		setSearchParams(newParams);
	};

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
						placeholder="Search by name, email, or use role:admin, role:user..."
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
								{users.length === 0 ? (
									<Table.Tr>
										<Table.Td colSpan={5}>
											<Text ta="center" c="dimmed" py="xl">
												No users found
											</Text>
										</Table.Td>
									</Table.Tr>
								) : (
									users.map((user) => (
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
														to={`/user/profile/${user.id}`}
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

					{totalPages > 1 && (
						<Group justify="center" mt="lg">
							<Pagination
								total={totalPages}
								value={currentPage}
								onChange={handlePageChange}
							/>
						</Group>
					)}
				</Paper>
			</Stack>
		</Container>
	);
}
