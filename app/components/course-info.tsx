import { Avatar, Card, Group, Paper, Stack, Text } from "@mantine/core";
import { href, Link } from "react-router";

interface CourseInfoProps {
	course: {
		id: number;
		title: string;
		slug: string;
		description: string;
		status: string;
		instructors: Array<{
			id: number;
			name: string;
			email: string;
			role: "teacher" | "ta";
			avatar?:
				| number
				| {
						id: number;
						filename?: string | null;
				  }
				| null;
		}>;
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
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: HTML content from rich text editor */}
					<Text dangerouslySetInnerHTML={{ __html: course.description }} />
				</div>

				<Group grow>
					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Instructors
						</Text>
						<Stack gap="sm">
							{course.instructors.length > 0 ? (
								course.instructors.map((instructor) => (
									<Group key={instructor.id} gap="sm">
										<Avatar
											size="sm"
											src={
												instructor.avatar
													? `/api/media/file/${typeof instructor.avatar === "object" ? instructor.avatar.filename : instructor.avatar}`
													: undefined
											}
											name={instructor.name}
										/>
										<div>
											<Text
												component={Link}
												to={href("/user/profile/:id?", {
													id: String(instructor.id),
												})}
											>
												{instructor.name}
											</Text>
											<Text size="xs" c="dimmed">
												{instructor.role === "teacher"
													? "Teacher"
													: "Teaching Assistant"}
											</Text>
										</div>
									</Group>
								))
							) : (
								<Text size="sm" c="dimmed">
									No instructors assigned
								</Text>
							)}
						</Stack>
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
