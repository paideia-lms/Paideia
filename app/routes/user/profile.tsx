import {
	ActionIcon,
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
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import {
	tryDeleteActivityModule,
	tryGetUserActivityModules,
} from "server/internal/activity-module-management";
import { tryFindLinksByActivityModule } from "server/internal/course-activity-module-link-management";
import { tryFindUserById } from "server/internal/user-management";
import { assertRequestMethod } from "~/utils/assert-request-method";
import {
	badRequest,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/profile";

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

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

	// Fetch activity modules for the current logged-in user
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: currentUser.id,
		limit: 50,
	});

	const modules = modulesResult.ok ? modulesResult.value.docs : [];

	// Fetch course link counts for each module
	const modulesWithLinkCounts = await Promise.all(
		modules.map(async (module) => {
			const linksResult = await tryFindLinksByActivityModule(payload, module.id);
			const linkCount = linksResult.ok ? linksResult.value.length : 0;
			return {
				...module,
				linkCount,
			};
		}),
	);

	// Check if user can create modules
	const canCreateModules =
		currentUser.role === "admin" ||
		currentUser.role === "instructor" ||
		currentUser.role === "content-manager";

	// Check if user can edit this profile
	const canEdit = userId === currentUser.id || currentUser.role === "admin";

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
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "DELETE");

	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

	const formData = await request.formData();
	const moduleId = Number(formData.get("moduleId"));

	if (Number.isNaN(moduleId)) {
		return badRequest({ error: "Invalid module ID" });
	}

	// Verify the user owns this module by fetching it first
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: currentUser.id,
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
		notifications.show({
			title: "Module deleted",
			message: "Your activity module has been deleted successfully",
			color: "green",
		});
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
	const { user, isOwnProfile, modules, canCreateModules, canEdit } = loaderData;
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
										{isOwnProfile && <Table.Th>Actions</Table.Th>}
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
											{isOwnProfile && (
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
