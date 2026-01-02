import {
	Button,
	Group,
	Modal,
	MultiSelect,
	Select,
	Stack,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconUserPlus } from "@tabler/icons-react";
import type { SearchUser } from "~/routes/api/search-users";
import { SearchUserCombobox } from "~/routes/api/search-users";
import { useEnrollUser } from "../route";
import type { Enrollment } from "server/payload-types";

interface EnrollUserButtonProps {
	courseId: number;
	enrolledUserIds: number[];
	availableGroups: Array<{ value: string; label: string }>;
	disabled?: boolean;
}

export function EnrollUserButton({
	courseId,
	enrolledUserIds,
	availableGroups,
	disabled = false,
}: EnrollUserButtonProps) {
	const [opened, { open, close }] = useDisclosure(false);
	const { submit: enrollUser, isLoading: isEnrolling } = useEnrollUser();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			selectedUsers: [] as SearchUser[],
			role: null as string | null,
			status: null as string | null,
			groups: [] as string[],
		},
		validate: {
			selectedUsers: (value) =>
				value.length === 0 ? "At least one user must be selected" : null,
			role: (value) => (!value ? "Role is required" : null),
			status: (value) => (!value ? "Status is required" : null),
		},
	});

	const handleSubmit = form.onSubmit(async (values) => {
		// Submit each user enrollment
		for (const user of values.selectedUsers) {
			await enrollUser({
				values: {
					userId: user.id,
					role: values.role as Enrollment["role"],
					status: values.status as Enrollment["status"],
					groups: values.groups.map(Number),
				},
				params: { courseId: courseId },
			});
		}
		form.reset();
		close();
	});

	return (
		<>
			<Button
				leftSection={<IconUserPlus size={16} />}
				onClick={open}
				disabled={disabled || isEnrolling}
			>
				Enrol User
			</Button>
			<Modal
				opened={opened}
				onClose={close}
				title="Enrol Users"
				centered
				size="md"
			>
				<form onSubmit={handleSubmit}>
					<Stack gap="md">
						<SearchUserCombobox
							value={form.getValues().selectedUsers}
							onChange={(users) => {
								form.setFieldValue("selectedUsers", users);
							}}
							placeholder="Search and select users to enroll..."
							excludeUserIds={enrolledUserIds}
							disabled={isEnrolling}
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
							key={form.key("role")}
							{...form.getInputProps("role")}
							disabled={isEnrolling}
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
							key={form.key("status")}
							{...form.getInputProps("status")}
							disabled={isEnrolling}
						/>
						<MultiSelect
							label="Groups"
							placeholder="Select groups (optional)"
							data={availableGroups}
							key={form.key("groups")}
							{...form.getInputProps("groups")}
							disabled={isEnrolling}
							searchable
							clearable
						/>
						<Group justify="flex-end" gap="sm">
							<Button variant="default" onClick={close}>
								Cancel
							</Button>
							<Button type="submit" loading={isEnrolling}>
								Enrol {form.getValues().selectedUsers.length} User
								{form.getValues().selectedUsers.length !== 1 ? "s" : ""}
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</>
	);
}
