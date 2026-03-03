import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Collapse,
	Container,
	Grid,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { AttachmentViewer } from "~/components/attachment-viewer";
import { RichTextRenderer } from "app/components/rich-text/rich-text-renderer";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import type { Route } from "../../route";
import { AssignmentGradingForm } from "./assignment-grading-form";

// ============================================================================
// Types
// ============================================================================

export type AssignmentGradingViewProps = Extract<
	Route.ComponentProps["loaderData"],
	{ gradingModuleType: "assignment" }
>;

// ============================================================================
// Component
// ============================================================================

export function AssignmentGradingView({
	loaderData,
}: {
	loaderData: AssignmentGradingViewProps;
}) {
	const submission = loaderData.gradingSubmission;
	const module = loaderData.module;
	const moduleSettings = loaderData.moduleSettings;
	const course = loaderData.course;
	const moduleLinkId = loaderData.moduleLinkId;
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
					to={getRouteUrl("/course/module/:moduleLinkId/submissions", {
						params: { moduleLinkId: moduleLinkId.toString() },
						searchParams: {},
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
					<AssignmentGradingForm loaderData={loaderData} />
				</Grid.Col>
			</Grid>
		</Box>
	);
}
