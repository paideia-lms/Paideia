import {
	Avatar,
	Card,
	Group,
	Image,
	Paper,
	Stack,
	Text,
	Tooltip,
	Typography,
} from "@mantine/core";
import { href, Link } from "react-router";

interface CourseInfoProps {
	course: {
		id: number;
		title: string;
		slug: string;
		description: string;
		status: string;
		thumbnail?:
		| number
		| {
			id: number;
			filename?: string | null;
		}
		| null;
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
				{course.thumbnail && (
					<Image
						src={`/api/media/file/${typeof course.thumbnail === "object" ? course.thumbnail.filename : course.thumbnail}`}
						alt={course.title}
						radius="md"
						h={200}
						fit="cover"
					/>
				)}

				<div>
					<Text fw={600} size="sm" c="dimmed" mb="xs">
						Description
					</Text>
					<Typography
						classNames={{
							root: "tiptap",
						}}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML content from rich text editor
						dangerouslySetInnerHTML={{ __html: course.description }}
					/>
				</div>

				<Group grow>
					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Instructors
						</Text>
						{course.instructors.length > 0 ? (
							<Avatar.Group>
								{course.instructors.map((instructor) => (
									<Tooltip
										key={instructor.id}
										label={
											<div>
												<Text size="sm" fw={500}>
													{instructor.name}
												</Text>
												<Text size="xs" c="dimmed">
													{instructor.role === "teacher"
														? "Teacher"
														: "Teaching Assistant"}
												</Text>
											</div>
										}
										withArrow
									>
										<Avatar
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(instructor.id),
											})}
											src={
												instructor.avatar
													? `/api/media/file/${typeof instructor.avatar === "object" ? instructor.avatar.filename : instructor.avatar}`
													: undefined
											}
											name={instructor.name}
											style={{ cursor: "pointer" }}
										/>
									</Tooltip>
								))}
							</Avatar.Group>
						) : (
							<Text size="sm" c="dimmed">
								No instructors assigned
							</Text>
						)}
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
