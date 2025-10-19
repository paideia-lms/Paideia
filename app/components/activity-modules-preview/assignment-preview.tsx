import { Paper, Text, Title, Stack } from "@mantine/core";

export function AssignmentPreview() {
    return (
        <Paper withBorder p="xl" radius="md">
            <Stack gap="md">
                <Title order={3}>Assignment Preview</Title>
                <Text c="dimmed">
                    Assignment preview is not yet implemented. This module allows students to
                    submit their work for grading.
                </Text>
            </Stack>
        </Paper>
    );
}

