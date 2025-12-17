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
import { getRouteUrl } from "app/routes/course.$id.participants.profile";
import { useEffectEvent } from "react";
import { href, Link } from "react-router";
import { RichTextRenderer } from "~/components/rich-text-renderer";
import { useGradeSubmission } from "../hooks";

// ============================================================================
// Types
// ============================================================================

interface GradingFormValues {
	score: number | string;
	feedback: string;
}

interface DiscussionSubmissionItem {
	id: number;
	status: "draft" | "published" | "hidden" | "deleted";
	postType: "thread" | "reply" | "comment";
	title?: string | null;
	content: string;
	publishedAt?: string | null;
	createdAt: string;
	grade?: number | null;
	feedback?: string | null;
	gradedAt?: string | null;
	parentThread?: number | null;
	parentPost?: DiscussionSubmissionItem | null;
	ancestors?: DiscussionSubmissionItem[];
	author?: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
		avatar?:
			| number
			| {
					id: number;
					filename?: string | null;
			  }
			| null;
	} | null;
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
					avatar?:
						| number
						| {
								id: number;
								filename?: string | null;
						  }
						| null;
			  }
			| number;
		studentSubmissions?: DiscussionSubmissionItem[];
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
	maxGrade?: number | null;
}

// ============================================================================
// Component
// ============================================================================

// Post context collapse component - shows all ancestors up to thread
function PostContextCollapse({
	ancestors,
	course,
}: {
	ancestors: DiscussionSubmissionItem[];
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
							const avatarId =
								typeof ancestor.author.avatar === "object"
									? ancestor.author.avatar.id
									: ancestor.author.avatar;
							return `/api/media/file/${avatarId}`;
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
												to={getRouteUrl(course.id, ancestor.author.id)}
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

	const { gradeSubmission, isGrading } = useGradeSubmission(moduleLinkId);

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

		gradeSubmission(post.id, scoreValue, values.feedback || undefined);
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
	onReleaseGrade: _onReleaseGrade,
	isReleasing: _isReleasing,
	enrollment: _enrollment,
	courseModuleLink: _courseModuleLink,
	maxGrade,
}: DiscussionGradingViewProps) {
	// Get student information
	const student = submission.student;
	const studentId = typeof student === "object" ? student.id : student;
	const studentName =
		typeof student === "object"
			? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
				student.email
			: "Unknown Student";
	const studentEmail = typeof student === "object" ? student.email : "";

	// Get avatar URL
	const getAvatarUrl = (): string | undefined => {
		if (typeof student !== "object" || !student.avatar) return undefined;
		const avatarId =
			typeof student.avatar === "object" ? student.avatar.id : student.avatar;
		return `/api/media/file/${avatarId}`;
	};

	const avatarUrl = getAvatarUrl();

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
