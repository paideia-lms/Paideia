import {
	ActionIcon,
	Button,
	Group,
	Modal,
	MultiSelect,
	Select,
	Stack,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconEdit } from "@tabler/icons-react";
import { useEditEnrollment } from "../route";
import type { Route } from "../route";

type Enrollment = NonNullable<Route.ComponentProps["loaderData"]["enrolment"]>;

interface EditEnrollmentButtonProps {
	enrollment: Enrollment;
	courseId: number;
	availableGroups: Array<{ value: string; label: string }>;
	disabled?: boolean;
}

export function EditEnrollmentButton({
	enrollment,
	courseId,
	availableGroups,
	disabled = false,
}: EditEnrollmentButtonProps) {
	const [opened, { open, close }] = useDisclosure(false);
	const { submit: editEnrollment, isLoading: isEditing } = useEditEnrollment();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			role: enrollment.role,
			status: enrollment.status,
			groups: enrollment.groups.map((g) => g.id.toString()),
		},
		validate: {
			role: (value) => (!value ? "Role is required" : null),
			status: (value) => (!value ? "Status is required" : null),
		},
	});

	const handleSubmit = form.onSubmit(async (values) => {
		await editEnrollment({
			values: {
				enrollmentId: enrollment.id,
				role: values.role as Enrollment["role"],
				status: values.status as Enrollment["status"],
				groups: values.groups.map(Number),
			},
			params: { courseId: courseId },
		});
		form.reset();
		close();
	});

	return (
		<>
			<ActionIcon
				variant="light"
				color="blue"
				size="md"
				aria-label="Edit enrollment"
				onClick={open}
				disabled={disabled || isEditing}
			>
				<IconEdit size={16} />
			</ActionIcon>
			<Modal opened={opened} onClose={close} title="Edit Enrollment" centered>
				<form onSubmit={handleSubmit}>
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
							key={form.key("role")}
							{...form.getInputProps("role")}
							disabled={isEditing}
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
							disabled={isEditing}
						/>
						<MultiSelect
							label="Groups"
							placeholder="Select groups (optional)"
							data={availableGroups}
							key={form.key("groups")}
							{...form.getInputProps("groups")}
							disabled={isEditing}
							searchable
							clearable
						/>
						<Group justify="flex-end" gap="sm">
							<Button variant="default" onClick={close}>
								Cancel
							</Button>
							<Button type="submit" loading={isEditing}>
								Update Enrollment
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</>
	);
}
