import {
	Badge,
	Box,
	Button,
	Container,
	Grid,
	Group,
	NumberInput,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffectEvent } from "react";
import { href, Link } from "react-router";
import { useGradeSubmission } from "~/routes/course/module.$id.submissions";

// ============================================================================
// Types
// ============================================================================

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

export interface DiscussionGradingViewProps {
	submission: {
		id: number;
		status: "draft" | "submitted" | "graded" | "returned";
		submittedAt?: string | null;
		student:
			| {
					id: number;
					firstName?: string | null;
					lastName?: string | null;
					email?: string | null;
			  }
			| number;
	};
	module: {
		id: number;
		title: string;
		type: string;
	};
	moduleSettings?: {
		settings: {
			name?: string;
		};
	} | null;
	course: {
		id: number;
		title: string;
	};
	moduleLinkId: number;
	grade?: {
		baseGrade: number | null;
		maxGrade: number | null;
		feedback: string | null;
	} | null;
	onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
	isReleasing?: boolean;
	enrollment?:
		| {
				id: number;
		  }
		| number
		| null;
	courseModuleLink?:
		| {
				id: number;
		  }
		| number
		| null;
}

// ============================================================================
// Component
// ============================================================================

export function DiscussionGradingView({
	submission,
	module,
	moduleSettings,
	course,
	moduleLinkId,
	grade,
	onReleaseGrade,
	isReleasing = false,
	enrollment,
	courseModuleLink,
}: DiscussionGradingViewProps) {
	const form = useForm<GradingFormValues>({
		mode: "uncontrolled",
		initialValues: {
			score: grade?.baseGrade ?? "",
			feedback: grade?.feedback ?? "",
		},
	});

	const { gradeSubmission, isGrading } = useGradeSubmission();

	const handleSubmit = useEffectEvent((values: GradingFormValues) => {
		const scoreValue =
			typeof values.score === "number"
				? values.score
				: Number.parseFloat(String(values.score));
		if (Number.isNaN(scoreValue)) {
			notifications.show({
				title: "Error",
				message: "Invalid score value",
				color: "red",
			});
			return;
		}

		gradeSubmission(submission.id, scoreValue, values.feedback || undefined);
	});

	// Get student information
	const student = submission.student;
	const studentName =
		typeof student === "object"
			? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
				student.email
			: "Unknown Student";
	const studentEmail = typeof student === "object" ? student.email : "";

	const title = `Grade Discussion - ${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Box>
			<title>{title}</title>
			<meta
				name="description"
				content="Grade student discussion participation"
			/>
			<meta property="og:title" content={title} />

			{/* Back Button */}
			<Container size="xl">
				<Button
					component={Link}
					to={href("/course/module/:moduleLinkId/submissions", {
						moduleLinkId: moduleLinkId.toString(),
					})}
					variant="subtle"
				>
					← Back to Submissions
				</Button>
			</Container>

			{/* Two-column layout */}
			<Grid columns={12}>
				<Grid.Col span={6}>
					<Stack gap="sm">
						{/* Header Section */}
						<Paper withBorder shadow="sm" p="md" radius="md">
							<Stack gap="xs">
								<Group justify="space-between">
									<div>
										<Title order={3}>Student Discussion Participation</Title>
										<Text size="sm" c="dimmed">
											{studentName} {studentEmail && `(${studentEmail})`}
										</Text>
									</div>
									<Group gap="xs">
										<Badge
											color={
												submission.status === "graded"
													? "green"
													: submission.status === "submitted"
														? "blue"
														: "gray"
											}
											variant="light"
										>
											{submission.status}
										</Badge>
									</Group>
								</Group>
								<Text size="sm" c="dimmed">
									Submitted:{" "}
									{submission.submittedAt
										? new Date(submission.submittedAt).toLocaleString()
										: "N/A"}
								</Text>
							</Stack>
						</Paper>

						{/* Discussion Content Section - Mock UI for now */}
						<Paper withBorder shadow="sm" p="md" radius="md">
							<Stack gap="md">
								<Title order={4}>Discussion Participation</Title>
								<Text c="dimmed">
									Discussion participation content will be displayed here. This
									is a mock UI for now.
								</Text>
							</Stack>
						</Paper>
					</Stack>
				</Grid.Col>

				<Grid.Col span={6}>
					{/* Right column - Fixed grading form */}
					<Paper withBorder shadow="sm" p="md" radius="md">
						<form onSubmit={form.onSubmit(handleSubmit)}>
							<Stack gap="md">
								<Title order={4}>Grade Participation</Title>

								<NumberInput
									label="Score"
									placeholder="Enter score"
									min={0}
									max={grade?.maxGrade ?? 100}
									key={form.key("score")}
									{...form.getInputProps("score")}
								/>

								<div>
									<Text size="sm" fw={500} mb="xs">
										Feedback
									</Text>
									<textarea
										style={{
											width: "100%",
											minHeight: "200px",
											padding: "8px",
											border: "1px solid #ced4da",
											borderRadius: "4px",
										}}
										placeholder="Provide feedback for the student..."
										value={form.values.feedback}
										onChange={(e) => {
											form.setFieldValue("feedback", e.target.value);
										}}
									/>
								</div>

								<Group justify="flex-end">
									<Button type="submit" variant="filled" loading={isGrading}>
										Submit Grade
									</Button>
									{grade?.baseGrade !== null &&
										grade?.baseGrade !== undefined &&
										submission.status === "graded" &&
										onReleaseGrade &&
										enrollment &&
										courseModuleLink && (
											<Button
												variant="outline"
												loading={isReleasing}
												onClick={() => {
													const enrollmentId =
														typeof enrollment === "number"
															? enrollment
															: enrollment.id;
													const courseModuleLinkId =
														typeof courseModuleLink === "number"
															? courseModuleLink
															: courseModuleLink.id;
													onReleaseGrade(courseModuleLinkId, enrollmentId);
												}}
											>
												Release Grade
											</Button>
										)}
								</Group>
							</Stack>
						</form>
					</Paper>
				</Grid.Col>
			</Grid>
		</Box>
	);
}
