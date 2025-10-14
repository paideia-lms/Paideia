import {
	Badge,
	Button,
	Checkbox,
	Paper,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import type { SearchUser } from "~/routes/api/search-users";
import { SearchUserCombobox } from "~/routes/api/search-users";

interface GrantedUser {
	id: number;
	grantedTo: {
		id: number;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
	};
	grantedAt: string;
}

interface Instructor {
	id: number;
	email: string;
	firstName?: string;
	lastName?: string;
	role: string;
	courseCount: number;
}

interface GrantAccessSectionProps {
	grants: GrantedUser[];
	instructors: Instructor[];
	fetcherState: string;
	onGrantAccess: (userIds: number[], notifyPeople: boolean) => void;
	onRevokeAccess: (userId: number) => void;
	excludeUserIds?: number[];
}

export function GrantAccessSection({
	grants,
	instructors,
	fetcherState,
	onGrantAccess,
	onRevokeAccess,
	excludeUserIds = [],
}: GrantAccessSectionProps) {
	const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
	const [notifyPeople, setNotifyPeople] = useState(false);

	const handleGrantAccess = () => {
		if (selectedUsers.length > 0) {
			onGrantAccess(
				selectedUsers.map((u) => u.id),
				notifyPeople,
			);
			setSelectedUsers([]);
			setNotifyPeople(false);
		}
	};

	const getDisplayName = (user: {
		firstName?: string | null;
		lastName?: string | null;
		email: string;
	}) => {
		const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
		return fullName || user.email;
	};

	return (
		<Paper withBorder shadow="md" p="xl" radius="md">
			<Title order={3} mb="lg">
				User Access
			</Title>

			<Stack gap="md" mb="xl">
				<SearchUserCombobox
					value={selectedUsers}
					onChange={setSelectedUsers}
					placeholder="Search users to grant access..."
					excludeUserIds={excludeUserIds}
					disabled={fetcherState === "submitting"}
				/>

				<Checkbox
					label="Notify people"
					checked={notifyPeople}
					onChange={(event) => setNotifyPeople(event.currentTarget.checked)}
					disabled={fetcherState === "submitting"}
				/>

				<Button
					onClick={handleGrantAccess}
					disabled={selectedUsers.length === 0 || fetcherState === "submitting"}
					loading={fetcherState === "submitting"}
				>
					Grant Access
				</Button>
			</Stack>

			<Title order={4} mb="md">
				Users with Access
			</Title>

			{grants.length === 0 && instructors.length === 0 ? (
				<Text c="dimmed" ta="center" py="xl">
					No users have access yet.
				</Text>
			) : (
				<Table.ScrollContainer minWidth={600}>
					<Table striped highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Access Type</Table.Th>
								<Table.Th>Grant Date / Source</Table.Th>
								<Table.Th>Action</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{/* Edit Access Users */}
							{grants.map((grant) => (
								<Table.Tr key={`grant-${grant.id}`}>
									<Table.Td>
										<Text
											fw={500}
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(grant.grantedTo.id),
											})}
										>
											{getDisplayName(grant.grantedTo)}
										</Text>
										<Text size="sm" c="dimmed">
											{grant.grantedTo.email}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge color="blue">Edit Access</Badge>
									</Table.Td>
									<Table.Td>
										<Text size="sm">
											{new Date(grant.grantedAt).toLocaleDateString()}
										</Text>
									</Table.Td>
									<Table.Td>
										<Button
											variant="subtle"
											color="red"
											size="xs"
											leftSection={<IconTrash size={14} />}
											onClick={() => onRevokeAccess(grant.grantedTo.id)}
											loading={fetcherState === "submitting"}
										>
											Remove
										</Button>
									</Table.Td>
								</Table.Tr>
							))}

							{/* Read-Only Instructors */}
							{instructors.map((instructor) => (
								<Table.Tr key={`instructor-${instructor.id}`}>
									<Table.Td>
										<Text
											fw={500}
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(instructor.id),
											})}
										>
											{getDisplayName(instructor)}
										</Text>
										<Text size="sm" c="dimmed">
											{instructor.email}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge color="gray">Read Only</Badge>
									</Table.Td>
									<Table.Td>
										<Text size="sm" c="dimmed">
											Instructor in {instructor.courseCount} linked course
											{instructor.courseCount !== 1 ? "s" : ""}
										</Text>
									</Table.Td>
									<Table.Td>
										<Text size="sm" c="dimmed">
											Auto-granted
										</Text>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			)}
		</Paper>
	);
}
