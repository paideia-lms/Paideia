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
import { href, Link } from "react-router";
import { z } from "zod";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateGroup,
	tryDeleteGroup,
} from "server/internal/course-management";
import { permissions } from "server/utils/permissions";
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

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createCreateGroupActionRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().min(1, "Group name is required"),
		description: z.string().optional(),
		parent: z.string().optional(),
		color: z.string().optional(),
		maxMembers: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.CreateGroup,
});

const createDeleteGroupActionRpc = createActionRpc({
	formDataSchema: z.object({
		groupId: z.coerce.number(),
	}),
	method: "POST",
	action: Action.DeleteGroup,
});

export function getRouteUrl(action: Action, courseId: number) {
	return (
		href("/course/:courseId/groups", {
			courseId: courseId.toString(),
		}) +
		"?" +
		stringify({ action })
	);
}

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

	// Check if user can manage groups
	const canManage = permissions.course.canManageGroups(
		currentUser,
		enrolmentContext?.enrolment,
	).allowed;

	return {
		course: courseContext.course,
		groups: courseContext.course.groups,
		enrolment: enrolmentContext?.enrolment,
		currentUser: currentUser,
		canManage,
	};
};

const [createGroupAction, useCreateGroup] = createCreateGroupActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { courseId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const createResult = await tryCreateGroup({
			payload,
			name: formData.name,
			course: Number(courseId),
			parent: formData.parent ? Number(formData.parent) : undefined,
			description: formData.description || undefined,
			color: formData.color || undefined,
			maxMembers: formData.maxMembers,
			isActive: true,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return ok({ success: true, message: "Group created successfully" });
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, params.courseId),
	},
);

const [deleteGroupAction, useDeleteGroup] = createDeleteGroupActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const deleteResult = await tryDeleteGroup({
			payload,
			groupId: formData.groupId,
			req: payloadRequest,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return ok({ success: true, message: "Group deleted successfully" });
	})!,
	{
		action: ({ searchParams, params }) =>
			getRouteUrl(searchParams.action, Number(params.courseId)),
	},
);

// Export hooks for use in components
export { useCreateGroup, useDeleteGroup };

const actionMap = {
	[Action.CreateGroup]: createGroupAction,
	[Action.DeleteGroup]: deleteGroupAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			error: "Action is required",
		});
	}

	return actionMap[actionType](args);
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

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

interface CreateGroupModalProps {
	courseId: number;
	groups: Route.ComponentProps["loaderData"]["groups"];
}

function CreateGroupModal({ courseId, groups }: CreateGroupModalProps) {
	const { submit: createGroup, isLoading: isCreatingGroup } = useCreateGroup();
	const [
		opened,
		{ open: openCreateModal, close: closeCreateModal },
	] = useDisclosure(false);

	// Form states
	const [groupName, setGroupName] = useState("");
	const [groupDescription, setGroupDescription] = useState("");
	const [groupParent, setGroupParent] = useState<string | null>(null);
	const [groupColor, setGroupColor] = useState("");
	const [groupMaxMembers, setGroupMaxMembers] = useState<number | string>("");

	const handleCreateGroup = async () => {
		if (!groupName) return;

		await createGroup({
			values: {
				name: groupName,
				description: groupDescription || undefined,
				parent: groupParent || undefined,
				color: groupColor || undefined,
				maxMembers: groupMaxMembers ? Number(groupMaxMembers) : undefined,
			},
			params: { courseId },
		});
		closeCreateModal();
		setGroupName("");
		setGroupDescription("");
		setGroupParent(null);
		setGroupColor("");
		setGroupMaxMembers("");
	};

	// Prepare parent group options
	const parentGroupOptions = groups.map((group) => ({
		value: group.id.toString(),
		label: `${group.name} (${group.path})`,
	}));

	return (
		<>
			<Button
				leftSection={<IconPlus size={16} />}
				onClick={openCreateModal}
				loading={isCreatingGroup}
			>
				Create Group
			</Button>

			<Modal opened={opened} onClose={closeCreateModal} title="Create Group" size="md">
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
		</>
	);
}

interface DeleteGroupActionIconProps {
	groupId: number;
	courseId: number;
}

function DeleteGroupActionIcon({ groupId, courseId }: DeleteGroupActionIconProps) {

	const { submit: deleteGroup, isLoading: isDeletingGroup } = useDeleteGroup();

	const handleDeleteGroup = async () => {
		if (window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
			await deleteGroup({
				values: {
					groupId,
				},
				params: { courseId },
			});
		}
	};
	return (
		<ActionIcon color="red" variant="subtle" onClick={handleDeleteGroup} loading={isDeletingGroup}>
			<IconTrash size={16} />
		</ActionIcon>
	);
}

export default function CourseGroupsPage({ loaderData }: Route.ComponentProps) {
	const { groups, course, canManage } = loaderData;

	// Get group members with their details
	const getGroupMembers = (groupId: number) => {
		return course.enrollments.filter((enrollment) =>
			enrollment.groups.some((group) => group.id === groupId),
		);
	};

	return (
		<Stack gap="md">
			<Group justify="space-between">
				<Title order={3}>Course Groups</Title>
				{canManage && <CreateGroupModal courseId={course.id} groups={groups} />}
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
											<DeleteGroupActionIcon groupId={group.id} courseId={course.id} />
										</Table.Td>
									)}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Paper>
			)}
		</Stack>
	);
}
