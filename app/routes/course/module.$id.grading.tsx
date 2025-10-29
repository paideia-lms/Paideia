import {
	Alert,
	Badge,
	Button,
	Container,
	Group,
	NumberInput,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconFile } from "@tabler/icons-react";
import { createLoader, parseAsInteger } from "nuqs/server";
import { href } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetAssignmentSubmissionById } from "server/internal/assignment-submission-management";
import { canSeeModuleSubmissions } from "server/utils/permissions";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { RichTextRenderer } from "~/components/rich-text-renderer";
import { SimpleRichTextEditor } from "~/components/simple-rich-text-editor";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/module.$id.grading";

// Define search params
export const gradingSearchParams = {
	submissionId: parseAsInteger,
};

export const loadSearchParams = createLoader(gradingSearchParams);

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Check if user can see submissions (and therefore grade them)
	const canSee = canSeeModuleSubmissions(
		currentUser,
		enrolmentContext?.enrolment,
	);

	if (!canSee) {
		throw new ForbiddenResponse(
			"You don't have permission to grade submissions",
		);
	}

	// Get submissionId from query params
	const { submissionId } = loadSearchParams(request);

	if (!submissionId) {
		return {
			module: courseModuleContext.module,
			moduleSettings: courseModuleContext.moduleLinkSettings,
			course: courseContext.course,
			moduleLinkId: courseModuleContext.moduleLinkId,
			submission: null,
		};
	}

	// Fetch submission based on module type
	// For now, we only support assignment submissions
	if (courseModuleContext.module.type !== "assignment") {
		throw badRequest({
			error: "Only assignment submissions can be graded at this time",
		});
	}

	const submissionResult = await tryGetAssignmentSubmissionById(payload, {
		id: submissionId,
	});

	if (!submissionResult.ok) {
		throw badRequest({ error: submissionResult.error.message });
	}

	const submission = submissionResult.value;

	// Verify the submission belongs to this module
	if (submission.courseModuleLink.id !== courseModuleContext.moduleLinkId) {
		throw new ForbiddenResponse("Submission does not belong to this module");
	}

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		course: courseContext.course,
		moduleLinkId: courseModuleContext.moduleLinkId,
		submission,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

export default function ModuleGradingPage({
	loaderData,
}: Route.ComponentProps) {
	const { module, moduleSettings, course, moduleLinkId, submission } = loaderData;

	const form = useForm<GradingFormValues>({
		mode: "uncontrolled",
		initialValues: {
			score: "",
			feedback: "",
		},
	});

	// Show error if no submission
	if (!submission) {
		return (
			<Container size="xl" py="xl">
				<Alert
					icon={<IconAlertCircle size={16} />}
					title="No Submission Selected"
					color="red"
				>
					Please select a submission to grade. Return to the submissions page
					and click the "Grade" button for a specific student.
				</Alert>
			</Container>
		);
	}

	const handleSubmit = (values: GradingFormValues) => {
		console.log("Grading form submitted:", {
			submissionId: submission.id,
			score: values.score,
			feedback: values.feedback,
		});
	};

	// Get student information
	const student = submission.student;
	const studentName =
		typeof student === "object"
			? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || student.email
			: "Unknown Student";
	const studentEmail = typeof student === "object" ? student.email : "";

	const title = `Grade Submission - ${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta name="description" content="Grade student submission" />
			<meta property="og:title" content={title} />

			<Stack gap="lg">
				{/* Header Section */}
				<Paper withBorder shadow="sm" p="md" radius="md">
					<Stack gap="xs">
						<Group justify="space-between">
							<div>
								<Title order={3}>Student Submission</Title>
								<Text size="sm" c="dimmed">
									{studentName} {studentEmail && `(${studentEmail})`}
								</Text>
							</div>
							<Group gap="xs">
								<Badge color="blue" variant="light">
									Attempt {submission.attemptNumber}
								</Badge>
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
							Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "N/A"}
						</Text>
					</Stack>
				</Paper>

				{/* Submission Content Section */}
				<Paper withBorder shadow="sm" p="md" radius="md">
					<Stack gap="md">
						<Title order={4}>Submission Content</Title>
						{submission.content ? (
							<RichTextRenderer content={submission.content} />
						) : (
							<Text c="dimmed">No text content submitted</Text>
						)}

						{/* Attachments */}
						{submission.attachments && submission.attachments.length > 0 && (
							<div>
								<Text size="sm" fw={600} mb="xs">
									Attachments ({submission.attachments.length}):
								</Text>
								<Stack gap="xs">
									{submission.attachments.map((attachment, index) => {
										const file = attachment.file;
										const fileId = typeof file === "object" ? file.id : file;
										const filename = typeof file === "object" ? file.filename : `File ${fileId}`;

										return (
											<Paper key={`${fileId}-${index.toString()}`} withBorder p="xs">
												<Group gap="xs">
													<IconFile size={16} />
													<a
														href={href("/api/media/file/:filenameOrId", {
															filenameOrId: fileId.toString(),
														})}
														target="_blank"
														rel="noreferrer"
													>
														<Text size="sm">{filename}</Text>
													</a>
													{attachment.description && (
														<Text size="xs" c="dimmed">
															- {attachment.description}
														</Text>
													)}
												</Group>
											</Paper>
										);
									})}
								</Stack>
							</div>
						)}
					</Stack>
				</Paper>

				{/* Grading Form Section */}
				<Paper withBorder shadow="sm" p="md" radius="md">
					<form onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="md">
							<Title order={4}>Grade Submission</Title>

							<NumberInput
								label="Score"
								placeholder="Enter score"
								min={0}
								max={100}
								key={form.key("score")}
								{...form.getInputProps("score")}
							/>

							<div>
								<Text size="sm" fw={500} mb="xs">
									Feedback
								</Text>
								<SimpleRichTextEditor
									content=""
									placeholder="Provide feedback for the student..."
									onChange={(value) => {
										form.setFieldValue("feedback", value);
									}}
								/>
							</div>

							<Group justify="flex-end">
								<Button type="submit" variant="filled">
									Submit Grade
								</Button>
							</Group>
						</Stack>
					</form>
				</Paper>
			</Stack>
		</Container>
	);
}

