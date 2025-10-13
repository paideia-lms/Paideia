import {
	ActionIcon,
	Alert,
	Avatar,
	Badge,
	Button,
	Container,
	Group,
	Modal,
	Paper,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconTrash, IconUserCheck } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryDeleteActivityModule,
	tryGetUserActivityModules,
} from "server/internal/activity-module-management";
import { tryFindLinksByActivityModule } from "server/internal/course-activity-module-link-management";
import { tryFindUserById } from "server/internal/user-management";
import { StopImpersonatingButton } from "~/routes/api/stop-impersonation";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { setImpersonationCookie } from "~/utils/cookie";
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/profile";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Fetch the user profile
	const userResult = await tryFindUserById({
		payload,
		userId,
		user: currentUser,
		overrideAccess: false,
	});

	if (!userResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	const profileUser = userResult.value;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (profileUser.avatar) {
		if (typeof profileUser.avatar === "object") {
			avatarUrl = profileUser.avatar.filename
				? href(`/api/media/file/:filename`, {
						filename: profileUser.avatar.filename,
					})
				: null;
		}
	}

	// Fetch activity modules for the target user
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: userId,
		limit: 50,
	});

	const modules = modulesResult.ok ? modulesResult.value.docs : [];

	// Fetch course link counts for each module
	const modulesWithLinkCounts = await Promise.all(
		modules.map(async (module) => {
			const linksResult = await tryFindLinksByActivityModule(
				payload,
				module.id,
			);
			const linkCount = linksResult.ok ? linksResult.value.length : 0;
			return {
				...module,
				linkCount,
			};
		}),
	);

	// Check if user can create modules (only for own profile)
	const canCreateModules =
		userId === currentUser.id &&
		(currentUser.role === "admin" ||
			currentUser.role === "instructor" ||
			currentUser.role === "content-manager");

	// Check if user can edit this profile
	const canEdit = userId === currentUser.id || currentUser.role === "admin";

	// Check if user can manage modules (edit/delete) - only for own profile or if admin
	const canManageModules =
		userId === currentUser.id || currentUser.role === "admin";

	// Check if user can impersonate (admin viewing someone else's profile, not an admin, and not already impersonating)
	const canImpersonate =
		userSession.authenticatedUser.role === "admin" &&
		userId !== userSession.authenticatedUser.id &&
		profileUser.role !== "admin" &&
		!userSession.isImpersonating;

	return {
		user: {
			id: profileUser.id,
			firstName: profileUser.firstName ?? "",
			lastName: profileUser.lastName ?? "",
			bio: profileUser.bio ?? "",
			avatarUrl,
		},
		isOwnProfile: userId === currentUser.id,
		modules: modulesWithLinkCounts,
		canCreateModules,
		canEdit,
		canManageModules,
		canImpersonate,
		isImpersonating: userSession.isImpersonating,
		authenticatedUser: userSession.authenticatedUser,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const requestInfo = context.get(globalContextKey).requestInfo;
	const userSession = context.get(userContextKey);
	const { id } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { authenticatedUser: currentUser } = userSession;

	// Determine which user's profile we're working with
	const targetUserId = id ? Number(id) : currentUser.id;

	const formData = await request.formData();
	const intent = formData.get("intent");

	// Handle impersonation actions
	if (intent === "impersonate") {
		if (currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can impersonate users" });
		}

		const targetUserId = Number(formData.get("targetUserId"));
		if (Number.isNaN(targetUserId)) {
			return badRequest({ error: "Invalid target user ID" });
		}

		// Verify the target user exists and is not an admin
		const targetUserResult = await tryFindUserById({
			payload,
			userId: targetUserId,
			user: currentUser,
			overrideAccess: true,
		});

		if (!targetUserResult.ok || !targetUserResult.value) {
			return badRequest({ error: "Target user not found" });
		}

		const targetUser = targetUserResult.value;
		if (targetUser.role === "admin") {
			return badRequest({ error: "Cannot impersonate admin users" });
		}

		// Set impersonation cookie and redirect
		throw redirect("/", {
			headers: {
				"Set-Cookie": setImpersonationCookie(
					targetUserId,
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	}

	// Handle existing DELETE action for module deletion
	assertRequestMethod(request.method, "DELETE");

	const moduleId = Number(formData.get("moduleId"));

	if (Number.isNaN(moduleId)) {
		return badRequest({ error: "Invalid module ID" });
	}

	// Check permissions: only allow deletion if current user is the target user or is admin
	const canDeleteModules =
		targetUserId === currentUser.id || currentUser.role === "admin";

	if (!canDeleteModules) {
		return unauthorized({
			error: "You don't have permission to delete this user's modules",
		});
	}

	// Verify the module exists and belongs to the target user
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: targetUserId,
		limit: 100,
	});

	if (!modulesResult.ok) {
		return badRequest({ error: "Failed to verify module ownership" });
	}

	const userModule = modulesResult.value.docs.find((m) => m.id === moduleId);

	if (!userModule) {
		return badRequest({
			error: "Module not found or you don't have permission to delete it",
		});
	}

	// Delete the module
	const deleteResult = await tryDeleteActivityModule(payload, moduleId);

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	return ok({ message: "Activity module deleted successfully" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		// Check if this was an impersonation action by looking at the response
		if (actionData.message === "Activity module deleted successfully") {
			notifications.show({
				title: "Module deleted",
				message: "Your activity module has been deleted successfully",
				color: "green",
			});
		}
		// Impersonation actions redirect, so no notification needed
	} else {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}

	return actionData;
}

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const {
		user,
		isOwnProfile,
		modules,
		canCreateModules,
		canEdit,
		canManageModules,
		canImpersonate,
		isImpersonating,
		authenticatedUser,
	} = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const [deleteModuleId, setDeleteModuleId] = useState<number | null>(null);
	const [opened, { open, close }] = useDisclosure(false);
	const fetcher = useFetcher();

	// Helper function to get badge color based on status
	const getStatusColor = (status: string) => {
		switch (status) {
			case "published":
				return "green";
			case "draft":
				return "yellow";
			case "archived":
				return "gray";
			default:
				return "blue";
		}
	};

	// Helper function to format type display
	const formatType = (type: string) => {
		return type
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Handler for delete confirmation
	const handleDeleteClick = (moduleId: number) => {
		setDeleteModuleId(moduleId);
		open();
	};

	const handleDeleteConfirm = () => {
		if (deleteModuleId === null) return;

		const formData = new FormData();
		formData.append("moduleId", String(deleteModuleId));
		fetcher.submit(formData, { method: "DELETE" });
		close();
	};

	// Handler for impersonation
	const handleImpersonate = () => {
		const formData = new FormData();
		formData.append("intent", "impersonate");
		formData.append("targetUserId", String(user.id));
		fetcher.submit(formData, { method: "POST" });
	};

	return (
		<Container size="md" py="xl">
			<title>{`${fullName} | Profile | Paideia LMS`}</title>
			<meta
				name="description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>
			<meta
				property="og:title"
				content={`${fullName} | Profile | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>

			<Stack gap="xl">
				{/* Impersonation Banner */}
				{isImpersonating && (
					<Alert
						color="orange"
						title="Impersonating User"
						icon={<IconUserCheck size={16} />}
					>
						You are currently viewing the system as {fullName}. You are logged
						in as {authenticatedUser.firstName} {authenticatedUser.lastName}.
						<div style={{ marginLeft: "1rem" }}>
							<StopImpersonatingButton
								size="xs"
								color="orange"
								variant="light"
							/>
						</div>
					</Alert>
				)}

				<Paper withBorder shadow="md" p="xl" radius="md">
					<Stack align="center" gap="lg">
						<Avatar
							src={user.avatarUrl}
							alt={fullName}
							size={120}
							radius={120}
						/>
						<div style={{ textAlign: "center" }}>
							<Title order={2} mb="xs">
								{fullName}
							</Title>
							{isOwnProfile && (
								<Text size="sm" c="dimmed" mb="md">
									Your Profile
								</Text>
							)}
						</div>
						{user.bio && (
							<div style={{ width: "100%" }}>
								<Text size="sm" fw={600} mb="xs">
									Bio
								</Text>
								<Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
									{user.bio}
								</Text>
							</div>
						)}
						<Group gap="md" w="100%">
							{canEdit && (
								<Button
									component={Link}
									to={isOwnProfile ? "/user/edit" : `/user/edit/${user.id}`}
									variant="light"
									fullWidth
								>
									Edit Profile
								</Button>
							)}
							{canImpersonate && (
								<Button
									variant="light"
									color="orange"
									onClick={handleImpersonate}
									loading={fetcher.state === "submitting"}
									fullWidth
									leftSection={<IconUserCheck size={16} />}
								>
									Impersonate User
								</Button>
							)}
						</Group>
					</Stack>
				</Paper>

				{/* Activity Modules Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" mb="lg">
						<Title order={3}>Activity Modules</Title>
						{isOwnProfile && canCreateModules && (
							<Button component={Link} to="/user/module/new" size="sm">
								Create Module
							</Button>
						)}
					</Group>

					{modules.length === 0 ? (
						<Text c="dimmed" ta="center" py="xl">
							No activity modules yet.
							{isOwnProfile && canCreateModules && " Create your first one!"}
						</Text>
					) : (
						<Table.ScrollContainer minWidth={800}>
							<Table striped highlightOnHover>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Name</Table.Th>
										<Table.Th>Description</Table.Th>
										<Table.Th>Type</Table.Th>
										<Table.Th>Status</Table.Th>
										<Table.Th>Linked Courses</Table.Th>
										{canManageModules && <Table.Th>Actions</Table.Th>}
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{modules.map((module) => (
										<Table.Tr key={module.id}>
											<Table.Td>
												<Text fw={500}>{module.title}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed" lineClamp={2} maw={300}>
													{module.description || "—"}
												</Text>
											</Table.Td>
											<Table.Td>
												<Badge variant="light">{formatType(module.type)}</Badge>
											</Table.Td>
											<Table.Td>
												<Badge color={getStatusColor(module.status)}>
													{module.status}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{module.linkCount}</Text>
											</Table.Td>
											{canManageModules && (
												<Table.Td>
													<Group gap="xs">
														<ActionIcon
															component={Link}
															to={`/user/module/edit/${module.id}`}
															variant="light"
															color="blue"
															size="md"
															aria-label="Edit module"
														>
															<IconEdit size={16} />
														</ActionIcon>
														<ActionIcon
															variant="light"
															color="red"
															size="md"
															aria-label="Delete module"
															onClick={() => handleDeleteClick(module.id)}
														>
															<IconTrash size={16} />
														</ActionIcon>
													</Group>
												</Table.Td>
											)}
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					)}
				</Paper>

				{/* Notes Link */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" align="center">
						<div>
							<Title order={3} mb="xs">
								Notes
							</Title>
							<Text size="sm" c="dimmed">
								View {isOwnProfile ? "your" : "their"} notes and activity
							</Text>
						</div>
						<Button
							component={Link}
							to={isOwnProfile ? "/user/notes" : `/user/notes/${user.id}`}
							variant="light"
						>
							View Notes
						</Button>
					</Group>
				</Paper>
			</Stack>

			{/* Delete Confirmation Modal */}
			<Modal
				opened={opened}
				onClose={close}
				title="Delete Activity Module"
				centered
			>
				<Stack gap="md">
					<Text>
						Are you sure you want to delete this activity module? This action
						cannot be undone.
					</Text>
					<Group justify="flex-end" gap="sm">
						<Button variant="default" onClick={close}>
							Cancel
						</Button>
						<Button
							color="red"
							onClick={handleDeleteConfirm}
							loading={fetcher.state === "submitting"}
						>
							Delete
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Container>
	);
}
