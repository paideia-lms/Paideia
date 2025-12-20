import {
	ActionIcon,
	Avatar,
	Button,
	ColorInput,
	Group,
	Modal,
	NumberInput,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useState } from "react";
import { href, Link, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateGroup,
	tryDeleteGroup,
} from "server/internal/course-management";
import { canManageCourseGroups } from "server/utils/permissions";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.groups";

export type { Route };

type Enrollment = NonNullable<Route.ComponentProps["loaderData"]["enrolment"]>;

enum Action {
	CreateGroup = "createGroup",
	DeleteGroup = "deleteGroup",
}

// Define search params for group actions
export const groupSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(groupSearchParams);

const getRouteUrl = (action: Action, courseId: number) => {
	return (
		href("/course/:courseId/groups", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
};

function GroupMemberList({ members }: { members: Enrollment[] }) {
	if (members.length === 0) {
		return (
			<Text size="sm" c="dimmed">
				No members
			</Text>
		);
	}

	const displayLimit = 5;
	const displayMembers = members.slice(0, displayLimit);
	const remainingCount = members.length - displayLimit;

	return (
		<Group gap="xs">
			<Avatar.Group spacing="sm">
				{displayMembers.map((member) => (
					<Tooltip
						key={member.id}
						label={member.user.firstName + " " + member.user.lastName}
						withArrow
					>
						<Avatar
							component={Link}
							to={href("/user/profile/:id?", {
								id: String(member.user.id),
							})}
							size="sm"
							color="blue"
							radius="xl"
						>
							{member.user.firstName?.charAt(0) ??
								member.user.lastName?.charAt(0)}
						</Avatar>
					</Tooltip>
				))}
			</Avatar.Group>
			{remainingCount > 0 && (
				<Text size="xs" c="dimmed">
					+{remainingCount} more
				</Text>
			)}
		</Group>
	);
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	return {
		course: courseContext.course,
		groups: courseContext.course.groups,
		enrolment: enrolmentContext?.enrolment,
		currentUser: currentUser,
	};
};

const createGroupAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action.CreateGroup } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const formData = await request.formData();
	const name = formData.get("name") as string;
	const description = formData.get("description") as string;
	const parentId = formData.get("parent");
	const color = formData.get("color") as string;
	const maxMembers = formData.get("maxMembers");

	if (!name) {
		return badRequest({ error: "Group name is required" });
	}

	const createResult = await tryCreateGroup({
		payload,
		name,
		course: Number(courseId),
		parent: parentId ? Number(parentId) : undefined,
		description: description || undefined,
		color: color || undefined,
		maxMembers: maxMembers ? Number(maxMembers) : undefined,
		isActive: true,
		req: payloadRequest,
	});

	if (!createResult.ok) {
		return badRequest({ error: createResult.error.message });
	}

	return ok({ success: true, message: "Group created successfully" });
};

const deleteGroupAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.DeleteGroup } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const formData = await request.formData();
	const groupId = Number(formData.get("groupId"));
	if (Number.isNaN(groupId)) {
		return badRequest({ error: "Invalid group ID" });
	}

	const deleteResult = await tryDeleteGroup({
		payload,
		groupId,
		req: payloadRequest,
	});

	if (!deleteResult.ok) {
		return badRequest({ error: deleteResult.error.message });
	}

	return ok({ success: true, message: "Group deleted successfully" });
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	if (actionType === Action.CreateGroup) {
		return createGroupAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.DeleteGroup) {
		return deleteGroupAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	return badRequest({
		error: "Invalid action",
	});
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export const useCreateGroup = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const createGroup = (
		name: string,
		description: string,
		parent: string,
		color: string,
		maxMembers: number,
		courseId: number,
	) => {
		fetcher.submit(
			{
				name,
				description,
				parent,
				color,
				maxMembers: maxMembers.toString(),
			},
			{
				method: "post",
				action: getRouteUrl(Action.CreateGroup, courseId),
			},
		);
	};

	return {
		createGroup,
		isLoading: fetcher.state === "submitting",
		data: fetcher.data,
	};
};

export const useDeleteGroup = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteGroup = (groupId: number, courseId: number) => {
		fetcher.submit(
			{
				groupId: groupId.toString(),
			},
			{
				method: "post",
				action: getRouteUrl(Action.DeleteGroup, courseId),
			},
		);
	};

	return {
		deleteGroup,
		isLoading: fetcher.state === "submitting",
		data: fetcher.data,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseGroupsPage({ loaderData }: Route.ComponentProps) {
	const { createGroup, isLoading: isCreatingGroup } = useCreateGroup();
	const { deleteGroup, isLoading: isDeletingGroup } = useDeleteGroup();
	const { groups, currentUser, course, enrolment } = loaderData;
	// Modal states
	const [
		createModalOpened,
		{ open: openCreateModal, close: closeCreateModal },
	] = useDisclosure(false);
	const [
		deleteModalOpened,
		{ open: openDeleteModal, close: closeDeleteModal },
	] = useDisclosure(false);

	// Form states
	const [groupName, setGroupName] = useState("");
	const [groupDescription, setGroupDescription] = useState("");
	const [groupParent, setGroupParent] = useState<string | null>(null);
	const [groupColor, setGroupColor] = useState("");
	const [groupMaxMembers, setGroupMaxMembers] = useState<number | string>("");
	const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

	// Get group members with their details
	const getGroupMembers = (groupId: number) => {
		return course.enrollments.filter((enrollment) =>
			enrollment.groups.some((group) => group.id === groupId),
		);
	};

	const handleCreateGroup = () => {
		if (!groupName) return;

		createGroup(
			groupName,
			groupDescription,
			groupParent || "",
			groupColor,
			Number(groupMaxMembers),
			course.id,
		);
		closeCreateModal();
		setGroupName("");
		setGroupDescription("");
		setGroupParent(null);
		setGroupColor("");
		setGroupMaxMembers("");
	};

	const handleDeleteGroup = (groupId: number) => {
		setDeletingGroupId(groupId);
		openDeleteModal();
	};

	const handleConfirmDeleteGroup = () => {
		if (deletingGroupId) {
			deleteGroup(deletingGroupId, course.id);
			closeDeleteModal();
			setDeletingGroupId(null);
		}
	};

	// Check if user can manage groups
	const canManage = canManageCourseGroups(currentUser, enrolment).allowed;

	// Prepare parent group options
	const parentGroupOptions = groups.map((group) => ({
		value: group.id.toString(),
		label: `${group.name} (${group.path})`,
	}));

	return (
		<>
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={3}>Course Groups</Title>
					{canManage && (
						<Button
							leftSection={<IconPlus size={16} />}
							onClick={openCreateModal}
						>
							Create Group
						</Button>
					)}
				</Group>

				{groups.length === 0 ? (
					<Paper p="xl" withBorder>
						<Text c="dimmed" ta="center">
							No groups created yet. Click "Create Group" to add one.
						</Text>
					</Paper>
				) : (
					<Paper withBorder>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Name</Table.Th>
									<Table.Th>Path</Table.Th>
									<Table.Th>Description</Table.Th>
									<Table.Th>Members</Table.Th>
									{canManage && <Table.Th>Actions</Table.Th>}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{groups.map((group) => (
									<Table.Tr key={group.id}>
										<Table.Td>
											<Group gap="xs">
												{group.color && (
													<div
														style={{
															width: 12,
															height: 12,
															borderRadius: "50%",
															backgroundColor: group.color,
														}}
													/>
												)}
												<Text fw={500}>{group.name}</Text>
											</Group>
										</Table.Td>
										<Table.Td>
											<Text size="sm" c="dimmed">
												{group.path}
											</Text>
										</Table.Td>
										<Table.Td>
											<Text size="sm" lineClamp={1}>
												{group.description || "-"}
											</Text>
										</Table.Td>
										<Table.Td>
											<GroupMemberList members={getGroupMembers(group.id)} />
										</Table.Td>
										{canManage && (
											<Table.Td>
												<ActionIcon
													color="red"
													variant="subtle"
													onClick={() => handleDeleteGroup(group.id)}
												>
													<IconTrash size={16} />
												</ActionIcon>
											</Table.Td>
										)}
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Paper>
				)}
			</Stack>

			{/* Create Group Modal */}
			<Modal
				opened={createModalOpened}
				onClose={closeCreateModal}
				title="Create Group"
				size="md"
			>
				<Stack gap="md">
					<TextInput
						label="Group Name"
						placeholder="Enter group name"
						required
						value={groupName}
						onChange={(e) => setGroupName(e.currentTarget.value)}
					/>

					<Textarea
						label="Description"
						placeholder="Enter group description (optional)"
						value={groupDescription}
						onChange={(e) => setGroupDescription(e.currentTarget.value)}
						rows={3}
					/>

					<Select
						label="Parent Group"
						placeholder="Select parent group (optional)"
						data={parentGroupOptions}
						value={groupParent}
						onChange={setGroupParent}
						clearable
						searchable
					/>

					<ColorInput
						label="Color"
						placeholder="Pick a color (optional)"
						value={groupColor}
						onChange={setGroupColor}
					/>

					<NumberInput
						label="Maximum Members"
						placeholder="Leave empty for unlimited"
						value={groupMaxMembers}
						onChange={setGroupMaxMembers}
						min={1}
					/>

					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={closeCreateModal}>
							Cancel
						</Button>
						<Button
							onClick={handleCreateGroup}
							disabled={!groupName}
							loading={isCreatingGroup}
						>
							Create Group
						</Button>
					</Group>
				</Stack>
			</Modal>

			{/* Delete Group Modal */}
			<Modal
				opened={deleteModalOpened}
				onClose={closeDeleteModal}
				title="Delete Group"
				size="sm"
			>
				<Stack gap="md">
					<Text>
						Are you sure you want to delete this group? This action cannot be
						undone.
					</Text>
					<Group justify="flex-end" mt="md">
						<Button variant="subtle" onClick={closeDeleteModal}>
							Cancel
						</Button>
						<Button
							color="red"
							onClick={handleConfirmDeleteGroup}
							loading={isDeletingGroup}
						>
							Delete Group
						</Button>
					</Group>
				</Stack>
			</Modal>
		</>
	);
}
