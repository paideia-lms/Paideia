import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Collapse,
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
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { AttachmentViewer } from "~/components/attachment-viewer";
import { RichTextRenderer } from "~/components/rich-text-renderer";
import { SimpleRichTextEditor } from "~/components/simple-rich-text-editor";

// ============================================================================
// Types
// ============================================================================

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

export interface GradingViewProps {
	submission: {
		id: number;
		attemptNumber: number;
		status: "draft" | "submitted" | "graded" | "returned";
		content?: string | null;
		submittedAt?: string | null;
		student:
			| {
					id: number;
					firstName?: string | null;
					lastName?: string | null;
					email?: string | null;
			  }
			| number;
		attachments?: Array<{
			file:
				| number
				| {
						id: number;
						filename?: string | null;
						mimeType?: string | null;
						filesize?: number | null;
						url?: string | null;
				  };
			description?: string | null;
		}> | null;
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
}

// ============================================================================
// Component
// ============================================================================

export function GradingView({
	submission,
	module,
	moduleSettings,
	course,
	moduleLinkId,
}: GradingViewProps) {
	// Track individual attachment expansion state (all expanded by default)
	const [expandedAttachments, setExpandedAttachments] = useState<
		Record<string, boolean>
	>(() => {
		const initial: Record<string, boolean> = {};
		submission.attachments?.forEach((_, index) => {
			initial[index.toString()] = true;
		});
		return initial;
	});

	const toggleAttachment = (index: number) => {
		setExpandedAttachments((prev) => ({
			...prev,
			[index.toString()]: !prev[index.toString()],
		}));
	};

	const form = useForm<GradingFormValues>({
		mode: "uncontrolled",
		initialValues: {
			score: "",
			feedback: "",
		},
	});

	const handleSubmit = (values: GradingFormValues) => {
		console.log("Grading form submitted:", {
			submissionId: submission.id,
			score: values.score,
			feedback: values.feedback,
		});
		// TODO: Implement actual grading submission
		// After successful submission, navigate back to submissions list
	};

	// Get student information
	const student = submission.student;
	const studentName =
		typeof student === "object"
			? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
				student.email
			: "Unknown Student";
	const studentEmail = typeof student === "object" ? student.email : "";

	const title = `Grade Submission - ${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Box>
			<title>{title}</title>
			<meta name="description" content="Grade student submission" />
			<meta property="og:title" content={title} />

			{/* Back Button */}
			<Container size="xl">
				<Button
					component={Link}
					to={href("/course/module/:id/submissions", {
						id: moduleLinkId.toString(),
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
									Submitted:{" "}
									{submission.submittedAt
										? new Date(submission.submittedAt).toLocaleString()
										: "N/A"}
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
								{submission.attachments &&
									submission.attachments.length > 0 && (
										<div>
											<Group justify="space-between" mb="xs">
												<Text size="sm" fw={600}>
													Attachments ({submission.attachments.length}):
												</Text>
											</Group>
											<Stack gap="md">
												{submission.attachments.map((attachment, index) => {
													const file = attachment.file;
													const fileData =
														typeof file === "object"
															? file
															: {
																	id: file,
																	filename: null,
																	mimeType: null,
																	filesize: null,
																	url: null,
																};
													const filename =
														fileData.filename || `File ${fileData.id}`;
													const isExpanded =
														expandedAttachments[index.toString()] ?? true;

													return (
														<Paper
															key={`${fileData.id}-${index.toString()}`}
															withBorder
															p="md"
														>
															<Stack gap="xs">
																<Group justify="space-between" wrap="nowrap">
																	<Text
																		size="sm"
																		fw={600}
																		style={{ flex: 1, minWidth: 0 }}
																	>
																		{filename}
																	</Text>
																	<ActionIcon
																		variant="subtle"
																		size="sm"
																		onClick={() => toggleAttachment(index)}
																		aria-label={
																			isExpanded
																				? "Collapse attachment"
																				: "Expand attachment"
																		}
																	>
																		{isExpanded ? (
																			<IconChevronUp size={16} />
																		) : (
																			<IconChevronDown size={16} />
																		)}
																	</ActionIcon>
																</Group>
																<Collapse in={isExpanded}>
																	<AttachmentViewer
																		file={fileData}
																		description={attachment.description}
																	/>
																</Collapse>
															</Stack>
														</Paper>
													);
												})}
											</Stack>
										</div>
									)}
							</Stack>
						</Paper>
					</Stack>
				</Grid.Col>

				<Grid.Col span={6}>
					{/* Right column - Fixed grading form */}
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
				</Grid.Col>
			</Grid>
		</Box>
	);
}
