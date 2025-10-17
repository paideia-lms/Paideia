import { Avatar, Card, Group, Paper, Stack, Text } from "@mantine/core";

interface CourseInfoProps {
	course: {
		id: number;
		title: string;
		slug: string;
		description: string;
		status: string;
		createdBy: {
			name: string,
			email: string,
			id: string,
			avatar?: {
				id: number;
				filename?: string | null;
			} | null;
		};
		createdAt: string;
		updatedAt: string;
		enrollmentCount: number;
	};
}

export function CourseInfo({ course }: CourseInfoProps) {
	return (
		<Paper withBorder shadow="sm" p="xl" radius="md">
			<Stack gap="xl">
				<div>
					<Text fw={600} size="sm" c="dimmed" mb="xs">
						Description
					</Text>
					<Text>{course.description}</Text>
				</div>

				<Group grow>
					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Created By
						</Text>
						<Group gap="sm">
							<Avatar
								size="sm"
								src={course.createdBy.avatar ? `/api/media/file/${course.createdBy.avatar.filename}` : undefined}
								name={course.createdBy.name}
							/>
							<Text>{course.createdBy.name}</Text>
						</Group>
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Enrollments
						</Text>
						<Text>{course.enrollmentCount}</Text>
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Created
						</Text>
						<Text>{new Date(course.createdAt).toLocaleDateString()}</Text>
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Updated
						</Text>
						<Text>{new Date(course.updatedAt).toLocaleDateString()}</Text>
					</Card>
				</Group>
			</Stack>
		</Paper>
	);
}
