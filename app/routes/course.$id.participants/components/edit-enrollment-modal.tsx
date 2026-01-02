import {
	Button,
	Group,
	Modal,
	MultiSelect,
	Select,
	Stack,
} from "@mantine/core";

interface EditEnrollmentModalProps {
	opened: boolean;
	onClose: () => void;
	selectedRole: string | null;
	onSelectedRoleChange: (role: string | null) => void;
	selectedStatus: string | null;
	onSelectedStatusChange: (status: string | null) => void;
	selectedGroups: string[];
	onSelectedGroupsChange: (groups: string[]) => void;
	availableGroups: Array<{ value: string; label: string }>;
	fetcherState: string;
	onUpdateEnrollment: () => void;
}

export function EditEnrollmentModal({
	opened,
	onClose,
	selectedRole,
	onSelectedRoleChange,
	selectedStatus,
	onSelectedStatusChange,
	selectedGroups,
	onSelectedGroupsChange,
	availableGroups,
	fetcherState,
	onUpdateEnrollment,
}: EditEnrollmentModalProps) {
	return (
		<Modal opened={opened} onClose={onClose} title="Edit Enrollment" centered>
			<Stack gap="md">
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
				/>
				<MultiSelect
					label="Groups"
					placeholder="Select groups (optional)"
					data={availableGroups}
					value={selectedGroups}
					onChange={onSelectedGroupsChange}
					searchable
					clearable
				/>
				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={onUpdateEnrollment}
						disabled={
							!selectedRole || !selectedStatus || fetcherState === "submitting"
						}
						loading={fetcherState === "submitting"}
					>
						Update Enrollment
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
