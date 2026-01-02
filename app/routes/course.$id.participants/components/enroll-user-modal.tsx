import {
	Button,
	Group,
	Modal,
	MultiSelect,
	Select,
	Stack,
} from "@mantine/core";
import type { SearchUser } from "~/routes/api/search-users";
import { SearchUserCombobox } from "~/routes/api/search-users";

interface EnrollUserModalProps {
	opened: boolean;
	onClose: () => void;
	selectedUsers: SearchUser[];
	onSelectedUsersChange: (users: SearchUser[]) => void;
	selectedRole: string | null;
	onSelectedRoleChange: (role: string | null) => void;
	selectedStatus: string | null;
	onSelectedStatusChange: (status: string | null) => void;
	selectedGroups: string[];
	onSelectedGroupsChange: (groups: string[]) => void;
	availableGroups: Array<{ value: string; label: string }>;
	enrolledUserIds: number[];
	fetcherState: string;
	onEnrollUsers: () => void;
}

export function EnrollUserModal({
	opened,
	onClose,
	selectedUsers,
	onSelectedUsersChange,
	selectedRole,
	onSelectedRoleChange,
	selectedStatus,
	onSelectedStatusChange,
	selectedGroups,
	onSelectedGroupsChange,
	availableGroups,
	enrolledUserIds,
	fetcherState,
	onEnrollUsers,
}: EnrollUserModalProps) {
	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Enrol Users"
			centered
			size="md"
		>
			<Stack gap="md">
				<SearchUserCombobox
					value={selectedUsers}
					onChange={onSelectedUsersChange}
					placeholder="Search and select users to enroll..."
					excludeUserIds={enrolledUserIds}
					disabled={fetcherState === "submitting"}
				/>
				<Select
					label="Role"
					placeholder="Select role"
					data={[
						{ value: "student", label: "Student" },
						{ value: "teacher", label: "Teacher" },
						{ value: "ta", label: "Teaching Assistant" },
						{ value: "manager", label: "Manager" },
					]}
					value={selectedRole}
					onChange={onSelectedRoleChange}
					disabled={fetcherState === "submitting"}
				/>
				<Select
					label="Status"
					placeholder="Select status"
					data={[
						{ value: "active", label: "Active" },
						{ value: "inactive", label: "Inactive" },
						{ value: "completed", label: "Completed" },
						{ value: "dropped", label: "Dropped" },
					]}
					value={selectedStatus}
					onChange={onSelectedStatusChange}
					disabled={fetcherState === "submitting"}
				/>
				<MultiSelect
					label="Groups"
					placeholder="Select groups (optional)"
					data={availableGroups}
					value={selectedGroups}
					onChange={onSelectedGroupsChange}
					disabled={fetcherState === "submitting"}
					searchable
					clearable
				/>
				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={onEnrollUsers}
						disabled={
							selectedUsers.length === 0 ||
							!selectedRole ||
							!selectedStatus ||
							fetcherState === "submitting"
						}
						loading={fetcherState === "submitting"}
					>
						Enrol {selectedUsers.length} User
						{selectedUsers.length !== 1 ? "s" : ""}
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
