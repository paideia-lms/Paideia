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
import { useDebouncedCallback } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { parseAsInteger, parseAsString } from "nuqs/server";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams } from "app/utils/search-params-utils";
import { useEffect, useState } from "react";
import { href, Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindAllUsers } from "server/internal/user-management";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/users";
import {
	getUserRoleBadgeColor,
	getUserRoleLabel,
} from "app/utils/course-view-utils";
import { getRouteUrl } from "app/utils/search-params-utils";

// Define search params
export const usersSearchParams = {
	query: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: usersSearchParams,
})(async ({ context, searchParams }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (userSession.authenticatedUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can view users");
	}

	// Get search params from URL
	const { query, page } = searchParams;

	// Fetch users with search and pagination
	const usersResult = await tryFindAllUsers({
		payload,
		query: query || undefined,
		limit: 10,
		page,
		sort: "-createdAt",
		req: payloadRequest,
		overrideAccess: false,
	});

	if (!usersResult.ok) {
		return badRequest({
			users: [],
			totalUsers: 0,
			totalPages: 0,
			currentPage: 1,
			error: usersResult.error.message,
			searchParams,
		});
	}

	const users = usersResult.value.docs.map((user) => {
		const avatarUrl = user.avatar
			? href(`/api/media/file/:mediaId`, {
					mediaId: user.avatar.id.toString(),
				})
			: null;

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
		searchParams,
	};
});

type UserSearchInputProps = {
	query: string;
};

function UserSearchInput({ query }: UserSearchInputProps) {
	const setQueryParams = useNuqsSearchParams(usersSearchParams);
	const [input, setInput] = useState(query || "");

	useEffect(() => {
		setInput(query || "");
	}, [query]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setQueryParams({
			query: value || null,
			page: 1, // Reset to page 1 when search changes
		});
	}, 500);

	return (
		<TextInput
			placeholder="Search by name, email, or use role:admin, role:user..."
			leftSection={<IconSearch size={16} />}
			value={input}
			onChange={(e) => {
				const v = e.currentTarget.value;
				setInput(v);
				debouncedSetQuery(v);
			}}
			mb="md"
		/>
	);
}

export default function UsersPage({ loaderData }: Route.ComponentProps) {
	const { users, totalUsers, totalPages, currentPage, searchParams } =
		loaderData;

	// Get setter from useNuqsSearchParams
	const setQueryParams = useNuqsSearchParams(usersSearchParams);

	// Handle page change
	const handlePageChange = (newPage: number) => {
		setQueryParams({ page: newPage });
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
						to={getRouteUrl("/admin/user/new", {})}
						leftSection={<IconPlus size={16} />}
					>
						Add User
					</Button>
				</Group>

				<Paper withBorder shadow="sm" p="md" radius="md">
					<UserSearchInput query={searchParams.query} />

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
												<Badge
													color={getUserRoleBadgeColor(user.role)}
													size="sm"
												>
													{getUserRoleLabel(user.role)}
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
