import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { getTypeLabel } from "./course-view-utils";
import type { ActivityModule as PayloadActivityModule } from "server/payload-types";
import {
	useCreateModuleLink,
	useDeleteModuleLink,
} from "~/routes/course.$id.modules";

interface ActivityModule {
	id: number;
	title: string;
	type: PayloadActivityModule["type"];
	description?: string | null;
}

interface ActivityModuleLink {
	id: number;
	activityModule: {
		id: string;
		title: string;
		type: PayloadActivityModule["type"];
		description?: string | null;
	};
	createdAt: string;
}

interface ActivityModulesSectionProps {
	existingLinks: ActivityModuleLink[];
	availableModules: ActivityModule[];
	canEdit: boolean;
	courseId: number;
}

interface AddModuleButtonProps {
	availableModules: ActivityModule[];
	courseId: number;
}

function AddModuleButton({
	availableModules,
	courseId,
}: AddModuleButtonProps) {
	const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
	const { submit: createModuleLink, isLoading: isCreating } =
		useCreateModuleLink();

	const handleAddModule = async () => {
		if (selectedModuleId) {
			await createModuleLink({
				values: {
					activityModuleId: Number.parseInt(selectedModuleId, 10),
				},
				params: { courseId },
			});
			setSelectedModuleId(null);
		}
	};

	return (
		<>
			<Select
				placeholder="Select activity module"
				data={availableModules.map((module) => ({
					value: module.id.toString(),
					label: `${module.title} (${getTypeLabel(module.type)})`,
				}))}
				value={selectedModuleId}
				onChange={setSelectedModuleId}
				disabled={isCreating}
				style={{ minWidth: 300 }}
			/>
			<Button
				leftSection={<IconPlus size={16} />}
				onClick={handleAddModule}
				disabled={isCreating || !selectedModuleId}
			>
				Add Module
			</Button>
		</>
	);
}

interface DeleteModuleButtonProps {
	linkId: number;
	courseId: number;
}

function DeleteModuleButton({ linkId, courseId }: DeleteModuleButtonProps) {
	const { submit: deleteModuleLink, isLoading: isDeleting } =
		useDeleteModuleLink();

	const handleDelete = async () => {
		await deleteModuleLink({
			values: {
				linkId,
			},
			params: { courseId },
		});
	};

	return (
		<ActionIcon
			variant="light"
			color="red"
			size="md"
			aria-label="Delete link"
			onClick={handleDelete}
			disabled={isDeleting}
		>
			<IconTrash size={16} />
		</ActionIcon>
	);
}

export function ActivityModulesSection({
	existingLinks,
	availableModules,
	canEdit,
	courseId,
}: ActivityModulesSectionProps) {
	return (
		<Paper withBorder shadow="sm" p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between">
					<Title order={2}>Linked Activity Modules</Title>
					{canEdit && (
						<Group gap="sm">
							{availableModules.length > 0 ? (
								<AddModuleButton
									availableModules={availableModules}
									courseId={courseId}
								/>
							) : (
								<Text size="sm" c="dimmed">
									No available modules to link
								</Text>
							)}
						</Group>
					)}
				</Group>

				{existingLinks.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No activity modules linked to this course yet.
					</Text>
				) : (
					<Box style={{ overflowX: "auto" }}>
						<Table striped highlightOnHover>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Module Title</Table.Th>
									<Table.Th>Type</Table.Th>
									<Table.Th>Created Date</Table.Th>
									{canEdit && <Table.Th>Actions</Table.Th>}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{existingLinks.map((link) => (
									<Table.Tr key={link.id}>
										<Table.Td>
											<Text
												fw={500}
												component={Link}
												to={href("/user/modules/:id?", {
													id: link.activityModule.id,
												})}
											>
												{typeof link.activityModule === "object"
													? link.activityModule.title
													: "Unknown Module"}
											</Text>
										</Table.Td>
										<Table.Td>
											<Badge variant="light">
												{typeof link.activityModule === "object"
													? getTypeLabel(link.activityModule.type)
													: "Unknown"}
											</Badge>
										</Table.Td>
										<Table.Td>
											<Text size="sm" c="dimmed">
												{new Date(link.createdAt).toLocaleDateString()}
											</Text>
										</Table.Td>
										{canEdit && (
											<Table.Td>
												<DeleteModuleButton linkId={link.id} courseId={courseId} />
											</Table.Td>
										)}
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Box>
				)}
			</Stack>
		</Paper>
	);
}
