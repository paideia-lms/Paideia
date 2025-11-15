import {
	Alert,
	Button,
	Card,
	Container,
	FileButton,
	Group,
	Paper,
	Stack,
	Text,
	Textarea,
	Title,
} from "@mantine/core";
import {
	IconAlertTriangle,
	IconCopy,
	IconDownload,
	IconRefresh,
	IconTrash,
	IconUpload,
} from "@tabler/icons-react";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseBackup } from "server/utils/permissions";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.backup";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const { courseId } = params;
	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can see course backup
	const canSeeBackup = canSeeCourseBackup(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
				role: enrolmentContext.enrolment.role,
			}
			: undefined,
	);

	if (!canSeeBackup) {
		throw new ForbiddenResponse(
			"You don't have permission to view course backups",
		);
	}

	return {
		course: courseContext.course,
		courseId,
	};
};

export default function CourseBackupPage({ loaderData }: Route.ComponentProps) {
	const { course } = loaderData;
	const title = `Course Reuse | ${course.title} | Paideia LMS`;

	return (
		<Container size="lg" py="xl">
			<title>{title}</title>
			<meta name="description" content="Course reuse and backup management" />
			<meta
				property="og:title"
				content={`Course Reuse | ${course.title} | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content="Course reuse and backup management"
			/>

			<Stack gap="xl">
				<div>
					<Title order={1} mb="xs">
						Course Reuse
					</Title>
					<Text c="dimmed">
						Manage course backups, imports, and reuse functionality for{" "}
						{course.title}
					</Text>
				</div>

				{/* Import Section */}
				<Card withBorder shadow="sm" p="lg">
					<Stack gap="md">
						<Group gap="sm">
							<IconUpload size={24} />
							<Title order={3}>Import</Title>
						</Group>
						<Text c="dimmed" size="sm">
							Import course content from a backup file or another course.
						</Text>
						<Group>
							<FileButton
								accept=".zip,.json"
								multiple={false}
								onChange={(file) => {
									// TODO: Handle file import
									console.log("Import file:", file);
								}}
							>
								{(props) => (
									<Button
										{...props}
										leftSection={<IconUpload size={16} />}
										variant="light"
									>
										Import from File
									</Button>
								)}
							</FileButton>
							<Button leftSection={<IconCopy size={16} />} variant="light">
								Import from Course
							</Button>
						</Group>
					</Stack>
				</Card>

				{/* Backup Section */}
				<Card withBorder shadow="sm" p="lg">
					<Stack gap="md">
						<Group gap="sm">
							<IconDownload size={24} />
							<Title order={3}>Backup</Title>
						</Group>
						<Text c="dimmed" size="sm">
							Create a backup of the current course content to download or
							restore later.
						</Text>
						<div>
							<Button leftSection={<IconDownload size={16} />} variant="filled">
								Create Backup
							</Button>
						</div>
						<Paper withBorder p="md" bg="gray.0">
							<Text size="sm" fw={500} mb="xs">
								Recent Backups
							</Text>
							<Text size="sm" c="dimmed">
								No backups available yet.
							</Text>
						</Paper>
					</Stack>
				</Card>

				{/* Restore Section */}
				<Card withBorder shadow="sm" p="lg">
					<Stack gap="md">
						<Group gap="sm">
							<IconRefresh size={24} />
							<Title order={3}>Restore</Title>
						</Group>
						<Text c="dimmed" size="sm">
							Restore course content from a previous backup. This will replace
							current content.
						</Text>
						<Alert
							icon={<IconAlertTriangle size={16} />}
							title="Warning"
							color="yellow"
						>
							Restoring from a backup will overwrite current course content.
							Consider creating a backup before restoring.
						</Alert>
						<Group>
							<FileButton
								accept=".zip,.json"
								multiple={false}
								onChange={(file) => {
									// TODO: Handle file restore
									console.log("Restore file:", file);
								}}
							>
								{(props) => (
									<Button
										{...props}
										leftSection={<IconRefresh size={16} />}
										variant="light"
										color="yellow"
									>
										Restore from File
									</Button>
								)}
							</FileButton>
						</Group>
					</Stack>
				</Card>

				{/* Copy Course Section */}
				<Card withBorder shadow="sm" p="lg">
					<Stack gap="md">
						<Group gap="sm">
							<IconCopy size={24} />
							<Title order={3}>Copy Course</Title>
						</Group>
						<Text c="dimmed" size="sm">
							Create a duplicate of this course with all content and structure.
						</Text>
						<Textarea
							label="New Course Title"
							placeholder="Enter title for the copied course"
							description="Leave empty to auto-generate with 'Copy of' prefix"
						/>
						<div>
							<Button leftSection={<IconCopy size={16} />} variant="light">
								Copy Course
							</Button>
						</div>
					</Stack>
				</Card>

				{/* Reset Section */}
				<Card withBorder shadow="sm" p="lg">
					<Stack gap="md">
						<Group gap="sm">
							<IconTrash size={24} />
							<Title order={3}>Reset</Title>
						</Group>
						<Text c="dimmed" size="sm">
							Reset course content and data. This action cannot be undone.
						</Text>
						<Alert
							icon={<IconAlertTriangle size={16} />}
							title="Danger Zone"
							color="red"
						>
							<Stack gap="sm">
								<Text size="sm">
									Resetting will permanently delete all course content, student
									submissions, and grades. This action is irreversible.
								</Text>
								<Group>
									<Button
										leftSection={<IconTrash size={16} />}
										variant="light"
										color="red"
									>
										Reset Course Content
									</Button>
									<Button
										leftSection={<IconTrash size={16} />}
										variant="filled"
										color="red"
									>
										Reset Everything
									</Button>
								</Group>
							</Stack>
						</Alert>
					</Stack>
				</Card>
			</Stack>
		</Container>
	);
}
