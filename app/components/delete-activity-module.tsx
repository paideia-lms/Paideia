import { Button, Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useDeleteActivityModule } from "~/routes/api/activity-module-delete";

interface DeleteActivityModuleProps {
    moduleId: number;
    hasLinkedCourses: boolean;
}

export function DeleteActivityModule({
    moduleId,
    hasLinkedCourses,
}: DeleteActivityModuleProps) {
    const { deleteModule, isLoading: isDeleting } = useDeleteActivityModule();

    const handleDelete = () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this activity module? This action cannot be undone. The module must not be linked to any courses to be deleted.",
        );
        if (confirmed) {
            deleteModule({ moduleId });
        }
    };

    return (
        <Paper
            withBorder
            shadow="sm"
            p="xl"
            style={{ borderColor: "var(--mantine-color-red-6)" }}
        >
            <Stack gap="md">
                <div>
                    <Title order={3} c="red">
                        Danger Zone
                    </Title>
                    <Text size="sm" c="dimmed" mt="xs">
                        Irreversible and destructive actions
                    </Text>
                </div>

                <Divider color="red" />

                <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                        <Text fw={500} mb="xs">
                            Delete this activity module
                        </Text>
                        {hasLinkedCourses ? (
                            <Text size="sm" c="dimmed">
                                This activity module cannot be deleted because it is linked to
                                one or more courses. Please remove it from all courses before
                                deleting.
                            </Text>
                        ) : (
                            <Text size="sm" c="dimmed">
                                Once you delete an activity module, there is no going back.
                                Please be certain.
                            </Text>
                        )}
                    </div>
                    <Button
                        color="red"
                        variant="light"
                        leftSection={<IconTrash size={16} />}
                        onClick={handleDelete}
                        loading={isDeleting}
                        disabled={hasLinkedCourses}
                        style={{ minWidth: "150px" }}
                    >
                        Delete Module
                    </Button>
                </Group>
            </Stack>
        </Paper>
    );
}

