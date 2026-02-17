import {
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Container,
	Group,
	NumberInput,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import { useEffectEvent } from "react";
import { href, Link } from "react-router";
import { RichTextRenderer } from "app/components/rich-text/rich-text-renderer";
import { useGradeSubmission } from "app/routes/course/module.$id.submissions/route";
import type { Route } from "../../route";

// ============================================================================
// Types
// ============================================================================

type DiscussionGradingLoaderData = Extract<
	Route.ComponentProps["loaderData"],
	{ gradingModuleType: "discussion" }
>;

type DiscussionSubmission = DiscussionGradingLoaderData["gradingSubmission"];

type DiscussionSubmissionItem = NonNullable<
	DiscussionSubmission["studentSubmissions"]
>[number];

// Ancestors come from allSubmissionsMap which includes author property
type DiscussionAncestorItem = NonNullable<
	DiscussionSubmissionItem["ancestors"]
>[number];

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

export interface DiscussionGradingViewProps {
	submission: DiscussionSubmission;
	module: DiscussionGradingLoaderData["module"];
	moduleSettings: DiscussionGradingLoaderData["moduleSettings"];
	course: DiscussionGradingLoaderData["course"];
	moduleLinkId: DiscussionGradingLoaderData["moduleLinkId"];
	grade: DiscussionGradingLoaderData["gradingGrade"];
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
	maxGrade: DiscussionGradingLoaderData["maxGrade"];
}

// ============================================================================
// Component
// ============================================================================

// Post context collapse component - shows all ancestors up to thread
function PostContextCollapse({
	ancestors,
	course,
}: {
	ancestors: DiscussionAncestorItem[];
	course: { id: number };
}) {
	const [opened, { toggle }] = useDisclosure(false);

	if (ancestors.length === 0) {
		return null;
	}

	// Count ancestors by type for the button label
	const threadCount = ancestors.filter((a) => a.postType === "thread").length;
	const replyCount = ancestors.filter((a) => a.postType === "reply").length;
	const commentCount = ancestors.filter((a) => a.postType === "comment").length;

	const contextLabel = [
		threadCount > 0 && `${threadCount} thread${threadCount > 1 ? "s" : ""}`,
		replyCount > 0 && `${replyCount} reply${replyCount > 1 ? "replies" : ""}`,
		commentCount > 0 && `${commentCount} comment${commentCount > 1 ? "s" : ""}`,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<Box>
			<Button
				variant="subtle"
				size="xs"
				onClick={toggle}
				style={{ padding: "4px 8px", height: "auto" }}
			>
				{opened ? "Hide" : "Show"} context ({contextLabel})
			</Button>
			<Collapse in={opened}>
				<Stack gap="sm" mt="xs">
					{ancestors.map((ancestor, index) => {
						const authorName = ancestor.author
							? `${ancestor.author.firstName ?? ""} ${ancestor.author.lastName ?? ""}`.trim() ||
							ancestor.author.email ||
							"Unknown"
							: "Unknown";

						const getAvatarUrl = (): string | undefined => {
							if (!ancestor.author?.avatar) return undefined;
							const avatar = ancestor.author.avatar;
							if (typeof avatar === "number") {
								return `/api/media/file/${avatar}`;
							}
							if (typeof avatar === "object" && avatar !== null && "id" in avatar) {
								const avatarObj = avatar as { id: number };
								return `/api/media/file/${avatarObj.id}`;
							}
							return undefined;
						};

						const avatarUrl = getAvatarUrl();

						return (
							<Paper
								key={ancestor.id}
								withBorder
								p="sm"
								radius="sm"
								style={{
									backgroundColor: "#f8f9fa",
									marginLeft: `${index * 16}px`,
									borderLeft: index > 0 ? "3px solid #dee2e6" : undefined,
								}}
							>
								<Stack gap="xs">
									<Group gap="sm" justify="space-between">
										{ancestor.author && (
											<Box
												component={Link}
												to={getRouteUrl(
													"/course/:courseId/participants/profile",
													{
														params: { courseId: course.id.toString() },
														searchParams: { userId: ancestor.author.id },
													},
												)}
												style={{ textDecoration: "none" }}
											>
												<Group gap="xs">
													<Avatar
														src={avatarUrl}
														alt={authorName}
														size="sm"
														style={{ cursor: "pointer" }}
													/>
													<Text
														size="sm"
														fw={500}
														style={{ cursor: "pointer" }}
													>
														{authorName}
													</Text>
												</Group>
											</Box>
										)}
										<Group gap="xs">
											{ancestor.publishedAt && (
												<Text size="xs" c="dimmed">
													Published:{" "}
													{new Date(ancestor.publishedAt).toLocaleString()}
												</Text>
											)}
											{!ancestor.publishedAt && (
												<Text size="xs" c="dimmed">
													Created:{" "}
													{new Date(ancestor.createdAt).toLocaleString()}
												</Text>
											)}
										</Group>
									</Group>
									{ancestor.title && (
										<Text size="sm" fw={500}>
											{ancestor.title}
										</Text>
									)}
									<Box>
										<RichTextRenderer content={ancestor.content} />
									</Box>
								</Stack>
							</Paper>
						);
					})}
				</Stack>
			</Collapse>
		</Box>
	);
}

// Per-post grading form component
function PostGradingForm({
	post,
	maxGrade,
	moduleLinkId,
}: {
	post: DiscussionSubmissionItem;
	maxGrade?: number | null;
	moduleLinkId: number;
}) {
	const form = useForm<GradingFormValues>({
		mode: "uncontrolled",
		initialValues: {
			score: post.grade ?? "",
			feedback: post.feedback ?? "",
		},
	});

	const { submit: gradeSubmission, isLoading: isGrading } =
		useGradeSubmission();

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

		gradeSubmission({
			params: { moduleLinkId },
			values: {
				submissionId: post.id,
				score: scoreValue,
				feedback: values.feedback || undefined,
			},
		});
	});

	return (
		<form onSubmit={form.onSubmit(handleSubmit)}>
			<Stack gap="sm">
				<NumberInput
					label="Score"
					placeholder="Enter score"
					min={0}
					max={maxGrade ?? 100}
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
							minHeight: "150px",
							padding: "8px",
							border: "1px solid #ced4da",
							borderRadius: "4px",
						}}
						placeholder="Provide feedback for this post..."
						value={form.values.feedback}
						onChange={(e) => {
							form.setFieldValue("feedback", e.target.value);
						}}
					/>
				</div>

				<Group justify="flex-end">
					<Button type="submit" variant="filled" size="sm" loading={isGrading}>
						{post.grade !== null && post.grade !== undefined
							? "Update Grade"
							: "Submit Grade"}
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

export function DiscussionGradingView({
	submission,
	module,
	moduleSettings,
	course,
	moduleLinkId,
	grade: _grade,
	enrollment: _enrollment,
	courseModuleLink: _courseModuleLink,
	maxGrade,
}: DiscussionGradingViewProps) {
	// Get student information
	const student = submission.student;
	const studentId = student.id;
	const studentName =
		`${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
		student.email ||
		"Unknown Student";
	const studentEmail = student.email ?? "";

	const avatarUrl = getRouteUrl("/api/user/:id/avatar", {
		params: { id: studentId.toString() },
	});

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

			{/* Single column layout */}
			<Container size="xl">
				<Stack gap="sm">
					{/* Header Section */}
					<Paper withBorder shadow="sm" p="md" radius="md">
						<Stack gap="xs">
							<Title order={3}>Student Discussion Participation</Title>
							<Box
								component={Link}
								to={
									href("/course/:courseId/participants/profile", {
										courseId: course.id.toString(),
									}) + `?userId=${studentId}`
								}
							>
								<Group gap="md">
									<Avatar
										src={avatarUrl}
										alt={studentName ?? undefined}
										size="sm"
										style={{ cursor: "pointer" }}
									/>
									<Text size="sm" c="dimmed">
										{studentName} {studentEmail && `(${studentEmail})`}
									</Text>
								</Group>
							</Box>
						</Stack>
					</Paper>

					{/* Discussion Content Section */}
					<Paper withBorder shadow="sm" p="md" radius="md">
						<Stack gap="md">
							<Text size="sm" fw={600}>
								Post History ({submission.studentSubmissions?.length ?? 0}{" "}
								{(submission.studentSubmissions?.length ?? 0) === 1
									? "post"
									: "posts"}
								)
							</Text>
							{submission.studentSubmissions &&
								submission.studentSubmissions.length > 0 ? (
								<Stack gap="md">
									{submission.studentSubmissions
										.sort((a, b) => {
											const dateA = a.publishedAt
												? new Date(a.publishedAt)
												: new Date(a.createdAt);
											const dateB = b.publishedAt
												? new Date(b.publishedAt)
												: new Date(b.createdAt);
											return dateB.getTime() - dateA.getTime();
										})
										.map((post) => {
											const postTypeLabel =
												post.postType === "thread"
													? "THREAD"
													: post.postType === "reply"
														? "REPLY"
														: "COMMENT";

											return (
												<Paper key={post.id} withBorder p="md" radius="sm">
													<Stack gap="md">
														<Group justify="space-between">
															<Group gap="sm">
																<Badge size="sm" variant="light" color="blue">
																	{postTypeLabel}
																</Badge>
																<Badge
																	color={
																		post.status === "published"
																			? "green"
																			: post.status === "draft"
																				? "gray"
																				: post.status === "hidden"
																					? "yellow"
																					: "red"
																	}
																	variant="light"
																>
																	{post.status.toUpperCase()}
																</Badge>
																{post.grade !== null &&
																	post.grade !== undefined && (
																		<Badge color="green" variant="filled">
																			{maxGrade !== null &&
																				maxGrade !== undefined
																				? `${post.grade}/${maxGrade}`
																				: String(post.grade)}
																		</Badge>
																	)}
																<Text size="xs" c="dimmed">
																	ID: {post.id}
																</Text>
															</Group>
														</Group>

														{/* Context collapse for replies and comments */}
														{post.postType !== "thread" &&
															post.ancestors &&
															post.ancestors.length > 0 && (
																<PostContextCollapse
																	ancestors={post.ancestors}
																	course={course}
																/>
															)}

														{post.title && (
															<Text size="sm" fw={600}>
																{post.title}
															</Text>
														)}
														<Box>
															<RichTextRenderer content={post.content} />
														</Box>
														<Group gap="sm">
															{post.publishedAt && (
																<Text size="sm" c="dimmed">
																	Published:{" "}
																	{new Date(post.publishedAt).toLocaleString()}
																</Text>
															)}
															{!post.publishedAt && (
																<Text size="sm" c="dimmed">
																	Created:{" "}
																	{new Date(post.createdAt).toLocaleString()}
																</Text>
															)}
															{post.gradedAt && (
																<Text size="sm" c="dimmed">
																	• Graded:{" "}
																	{new Date(post.gradedAt).toLocaleString()}
																</Text>
															)}
														</Group>
														{/* Grading form for this post */}
														<Box
															mt="md"
															pt="md"
															style={{ borderTop: "1px solid #e9ecef" }}
														>
															<PostGradingForm
																post={post}
																maxGrade={maxGrade}
																moduleLinkId={moduleLinkId}
															/>
														</Box>
													</Stack>
												</Paper>
											);
										})}
								</Stack>
							) : (
								<Text c="dimmed">No posts found for this student.</Text>
							)}
						</Stack>
					</Paper>
				</Stack>
			</Container>
		</Box>
	);
}
