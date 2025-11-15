import {
	ActionIcon,
	Anchor,
	Badge,
	Box,
	Button,
	Checkbox,
	Collapse,
	Container,
	Group,
	Menu,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
	IconChevronDown,
	IconChevronRight,
	IconDots,
	IconMail,
	IconPencil,
	IconSend,
	IconTrash,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { useEffect, useState } from "react";
import { href, Link, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryDeleteAssignmentSubmission,
	tryGetAssignmentSubmissionById,
	tryGradeAssignmentSubmission,
} from "server/internal/assignment-submission-management";
import { tryFindGradebookItemByCourseModuleLink } from "server/internal/gradebook-item-management";
import { tryReleaseGrade } from "server/internal/user-grade-management";
import {
	canDeleteSubmissions,
	canSeeModuleSubmissions,
} from "server/utils/permissions";
import { GradingView } from "~/components/grading-view";
import {
	type SubmissionData,
	SubmissionHistoryItem,
} from "~/components/submission-history";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { AssignmentActions } from "~/utils/module-actions";
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id.submissions";

// Define search params
export const submissionsSearchParams = {
	action: parseAsString,
	submissionId: parseAsInteger,
};

export const loadSearchParams = createLoader(submissionsSearchParams);

export const loader = async ({ context, request }: Route.LoaderArgs) => {
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

	// Check if user can see submissions
	const canSee = canSeeModuleSubmissions(
		currentUser,
		enrolmentContext?.enrolment,
	);

	if (!canSee) {
		throw new ForbiddenResponse(
			"You don't have permission to view submissions",
		);
	}

	// Check if user can delete submissions
	const canDelete = canDeleteSubmissions(
		currentUser,
		enrolmentContext?.enrolment,
	);

	// Get all enrollments for this course to show all students, filter out students
	const enrollments = courseContext.course.enrollments.filter(
		(enrollment) => enrollment.role === "student",
	);

	// Parse search params to check if we're in grading mode
	const { action, submissionId } = loadSearchParams(request);

	const payload = context.get(globalContextKey).payload;

	// If we're in grading mode, fetch the submission
	let gradingSubmission = null;
	let gradingGrade = null;
	if (action === AssignmentActions.GRADE_SUBMISSION && submissionId) {
		const submissionResult = await tryGetAssignmentSubmissionById({
			payload,
			id: submissionId,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			req: request,
			overrideAccess: false,
		});

		if (!submissionResult.ok) {
			throw badRequest({ error: submissionResult.error.message });
		}

		const submission = submissionResult.value;

		// Verify the submission belongs to this module
		if (submission.courseModuleLink.id !== courseModuleContext.moduleLinkId) {
			throw new ForbiddenResponse("Submission does not belong to this module");
		}

		gradingSubmission = submission;

		// Get grade from submission itself (grades are now stored on submissions)
		const submissionWithGrade = submission as typeof submission & {
			grade?: number | null;
			feedback?: string | null;
		};
		if (
			submissionWithGrade.grade !== null &&
			submissionWithGrade.grade !== undefined
		) {
			// Try to get maxGrade from gradebook item
			let maxGrade: number | null = null;
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				user: {
					...currentUser,
					avatar: currentUser.avatar?.id ?? undefined,
				},
				req: request,
				overrideAccess: false,
				courseModuleLinkId: courseModuleContext.moduleLinkId,
			});

			if (gradebookItemResult.ok) {
				maxGrade = gradebookItemResult.value.maxGrade ?? null;
			}

			gradingGrade = {
				baseGrade: submissionWithGrade.grade,
				maxGrade,
				feedback: submissionWithGrade.feedback || null,
			};
		}
	}

	// Fetch gradebook item to get maxGrade for all submissions
	let maxGrade: number | null = null;
	const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
		payload,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id ?? undefined,
		},
		req: request,
		overrideAccess: false,
		courseModuleLinkId: courseModuleContext.moduleLinkId,
	});

	if (gradebookItemResult.ok) {
		maxGrade = gradebookItemResult.value.maxGrade ?? null;
	}

	// Map submissions with grades from submission.grade field
	const submissionsWithGrades = courseModuleContext.submissions.map(
		(submission) => {
			const submissionWithGrade = submission as typeof submission & {
				grade?: number | null;
				feedback?: string | null;
				gradedAt?: string | null;
			};
			return {
				...submission,
				grade:
					submissionWithGrade.grade !== null &&
						submissionWithGrade.grade !== undefined
						? {
							baseGrade: submissionWithGrade.grade,
							maxGrade,
							gradedAt: submissionWithGrade.gradedAt || null,
							feedback: submissionWithGrade.feedback || null,
						}
						: null,
			};
		},
	);

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		course: courseContext.course,
		enrollments,
		submissions: submissionsWithGrades,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canDelete,
		gradingSubmission,
		gradingGrade,
		action,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const formData = await request.formData();
	const method = request.method;

	if (method === "DELETE") {
		assertRequestMethod(request.method, "DELETE");

		// Check if user can delete submissions
		const canDelete = canDeleteSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		);

		if (!canDelete) {
			return unauthorized({
				error: "You don't have permission to delete submissions",
			});
		}

		// Get submission ID from request
		const submissionId = formData.get("submissionId");

		if (!submissionId || typeof submissionId !== "string") {
			return badRequest({ error: "Submission ID is required" });
		}

		const id = Number.parseInt(submissionId, 10);
		if (Number.isNaN(id)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		// Delete the submission
		const deleteResult = await tryDeleteAssignmentSubmission({
			payload,
			id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			req: request,
			overrideAccess: false,
		});

		if (!deleteResult.ok) {
			return badRequest({ error: deleteResult.error.message });
		}

		return { success: true };
	}

	if (method === "POST") {
		assertRequestMethod(request.method, "POST");

		// Check if user can grade submissions (same as viewing submissions)
		const canGrade = canSeeModuleSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		);

		if (!canGrade) {
			return unauthorized({
				error: "You don't have permission to grade submissions",
			});
		}

		// Get form data
		const submissionId = formData.get("submissionId");
		const score = formData.get("score");
		const feedback = formData.get("feedback");

		// Validate submission ID
		if (!submissionId || typeof submissionId !== "string") {
			return badRequest({ error: "Submission ID is required" });
		}

		const id = Number.parseInt(submissionId, 10);
		if (Number.isNaN(id)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		// Validate score
		if (!score || typeof score !== "string") {
			return badRequest({ error: "Score is required" });
		}

		const scoreValue = Number.parseFloat(score);
		if (Number.isNaN(scoreValue) || scoreValue < 0) {
			return badRequest({ error: "Invalid score value" });
		}

		// Grade the submission (only updates submission, doesn't create user-grade)
		const gradeResult = await tryGradeAssignmentSubmission({
			payload,
			request,
			id,
			grade: scoreValue,
			feedback: feedback && typeof feedback === "string" ? feedback : undefined,
			gradedBy: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!gradeResult.ok) {
			const errorMessage = String(gradeResult.error);
			return badRequest({ error: errorMessage });
		}

		return { success: true, submission: gradeResult.value };
	}

	if (method === "PUT") {
		assertRequestMethod(request.method, "PUT");

		// Check if user can grade submissions (same as viewing submissions)
		const canGrade = canSeeModuleSubmissions(
			currentUser,
			enrolmentContext?.enrolment,
		);

		if (!canGrade) {
			return unauthorized({
				error: "You don't have permission to release grades",
			});
		}

		// Get form data for release grade
		const courseModuleLinkId = formData.get("courseModuleLinkId");
		const enrollmentId = formData.get("enrollmentId");

		// Validate course module link ID
		if (!courseModuleLinkId || typeof courseModuleLinkId !== "string") {
			return badRequest({ error: "Course module link ID is required" });
		}

		const courseModuleLinkIdValue = Number.parseInt(courseModuleLinkId, 10);
		if (Number.isNaN(courseModuleLinkIdValue)) {
			return badRequest({ error: "Invalid course module link ID" });
		}

		// Validate enrollment ID
		if (!enrollmentId || typeof enrollmentId !== "string") {
			return badRequest({ error: "Enrollment ID is required" });
		}

		const enrollmentIdValue = Number.parseInt(enrollmentId, 10);
		if (Number.isNaN(enrollmentIdValue)) {
			return badRequest({ error: "Invalid enrollment ID" });
		}

		// Release the grade
		const releaseResult = await tryReleaseGrade({
			payload,
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id ?? null,
			},
			req: request,
			overrideAccess: false,
			courseActivityModuleLinkId: courseModuleLinkIdValue,
			enrollmentId: enrollmentIdValue,
		});

		if (!releaseResult.ok) {
			const errorMessage = String(releaseResult.error);
			return badRequest({ error: errorMessage });
		}

		return { success: true, released: true };
	}

	return badRequest({ error: "Unsupported method" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		"status" in actionData &&
		(actionData.status === StatusCode.BadRequest ||
			actionData.status === StatusCode.Unauthorized)
	) {
		const errorMessage =
			"error" in actionData && typeof actionData.error === "string"
				? actionData.error
				: "Failed to process request";
		notifications.show({
			title: "Error",
			message: errorMessage,
			color: "red",
		});
	} else if ("success" in actionData && actionData.success) {
		// Determine which action succeeded based on the request method
		// This will be handled by the specific hooks
	}

	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

// ============================================================================
// Types
// ============================================================================

type SubmissionType = SubmissionData & {
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
};

type QuizSubmissionType = {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	attemptNumber: number;
	startedAt?: string | null;
	submittedAt?: string | null;
	timeSpent?: number | null;
	totalScore?: number | null;
	maxScore?: number | null;
	percentage?: number | null;
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
};

// ============================================================================
// Sub-components
// ============================================================================

function QuizSubmissionHistoryItem({
	attemptNumber,
	submission,
}: {
	attemptNumber: number;
	submission: QuizSubmissionType;
}) {
	return (
		<Paper withBorder p="md" radius="sm">
			<Stack gap="md">
				<Group justify="space-between">
					<Group gap="sm">
						<Badge size="sm" variant="light">
							Attempt {attemptNumber}
						</Badge>
						<Badge
							color={
								submission.status === "graded"
									? "green"
									: submission.status === "returned"
										? "blue"
										: submission.status === "completed"
											? "yellow"
											: "gray"
							}
							variant="light"
						>
							{submission.status === "in_progress"
								? "In Progress"
								: submission.status === "completed"
									? "Completed"
									: submission.status === "graded"
										? "Graded"
										: "Returned"}
						</Badge>
						{submission.status === "graded" || submission.status === "returned" ? (
							<Badge color="green" variant="filled">
								{submission.totalScore !== null &&
									submission.totalScore !== undefined &&
									submission.maxScore !== null &&
									submission.maxScore !== undefined
									? `${submission.totalScore}/${submission.maxScore}`
									: submission.totalScore !== null &&
										submission.totalScore !== undefined
										? String(submission.totalScore)
										: "-"}
								{submission.percentage !== null &&
									submission.percentage !== undefined
									? ` (${submission.percentage.toFixed(1)}%)`
									: ""}
							</Badge>
						) : null}
						<Text size="xs" c="dimmed">
							ID: {submission.id}
						</Text>
					</Group>
				</Group>
				<Group gap="sm">
					{submission.startedAt && (
						<Text size="sm" c="dimmed">
							Started: {new Date(submission.startedAt).toLocaleString()}
						</Text>
					)}
					{submission.submittedAt && (
						<Text size="sm" c="dimmed">
							{submission.startedAt ? "• " : ""}
							Submitted: {new Date(submission.submittedAt).toLocaleString()}
						</Text>
					)}
					{submission.timeSpent && (
						<Text size="sm" c="dimmed">
							{(submission.startedAt || submission.submittedAt) ? "• " : ""}
							Time Spent: {Math.round(submission.timeSpent)} min
						</Text>
					)}
				</Group>
			</Stack>
		</Paper>
	);
}

function QuizStudentSubmissionRow({
	courseId,
	enrollment,
	studentSubmissions,
}: {
	courseId: number;
	enrollment: Route.ComponentProps["loaderData"]["enrollments"][number];
	studentSubmissions: QuizSubmissionType[] | undefined;
}) {
	const [opened, { toggle }] = useDisclosure(false);

	const latestSubmission = studentSubmissions?.[0];
	const email = enrollment.email || "-";

	// Sort submissions by attempt number (newest first)
	const sortedSubmissions = studentSubmissions
		? [...studentSubmissions].sort((a, b) => {
			const attemptA = a.attemptNumber || 0;
			const attemptB = b.attemptNumber || 0;
			return attemptB - attemptA;
		})
		: [];

	// Filter to show all submissions that have been submitted (have submittedAt)
	// or are completed/graded/returned
	const submittedSubmissions = sortedSubmissions.filter(
		(sub) =>
			sub.submittedAt !== null ||
			sub.status === "completed" ||
			sub.status === "graded" ||
			sub.status === "returned",
	);

	const hasSubmissions = submittedSubmissions.length > 0;

	// Calculate total score if graded
	const gradedSubmissions = sortedSubmissions.filter(
		(s) => s.status === "graded" || s.status === "returned",
	);
	const totalScore = gradedSubmissions.reduce(
		(sum, s) => sum + (s.totalScore || 0),
		0,
	);
	const maxScore = gradedSubmissions.reduce(
		(sum, s) => sum + (s.maxScore || 0),
		0,
	);
	const averagePercentage =
		gradedSubmissions.length > 0
			? gradedSubmissions.reduce(
				(sum, s) => sum + (s.percentage || 0),
				0,
			) / gradedSubmissions.length
			: null;

	return (
		<>
			<Table.Tr>
				<Table.Td>
					<Group gap="xs" wrap="nowrap">
						{hasSubmissions && (
							<ActionIcon
								variant="subtle"
								size="sm"
								onClick={toggle}
								aria-label={opened ? "Collapse" : "Expand"}
							>
								{opened ? (
									<IconChevronDown size={16} />
								) : (
									<IconChevronRight size={16} />
								)}
							</ActionIcon>
						)}
						{!hasSubmissions && <Box style={{ width: 28 }} />}
						<div>
							<Anchor
								component={Link}
								to={
									href("/course/:courseId/participants/profile", {
										courseId: String(courseId),
									}) + `?userId=${enrollment.userId}`
								}
								size="sm"
							>
								{enrollment.name}
							</Anchor>
						</div>
					</Group>
				</Table.Td>
				<Table.Td>{email}</Table.Td>
				<Table.Td>
					{latestSubmission ? (
						<Badge
							color={
								latestSubmission.status === "graded"
									? "green"
									: latestSubmission.status === "returned"
										? "blue"
										: latestSubmission.status === "completed"
											? "yellow"
											: "gray"
							}
							variant="light"
						>
							{latestSubmission.status === "in_progress"
								? "In Progress"
								: latestSubmission.status === "completed"
									? "Completed"
									: latestSubmission.status === "graded"
										? "Graded"
										: "Returned"}
						</Badge>
					) : (
						<Badge color="gray" variant="light">
							No submission
						</Badge>
					)}
				</Table.Td>
				<Table.Td>
					{hasSubmissions ? (
						<Text size="sm">{submittedSubmissions.length}</Text>
					) : (
						<Text size="sm" c="dimmed">
							0
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{averagePercentage !== null ? (
						<Text size="sm" fw={500}>
							{totalScore > 0 && maxScore > 0
								? `${totalScore}/${maxScore}`
								: ""}{" "}
							({averagePercentage.toFixed(1)}%)
						</Text>
					) : latestSubmission?.status === "completed" ? (
						<Text size="sm" c="dimmed">
							Pending
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{latestSubmission?.timeSpent ? (
						<Text size="sm">
							{Math.round(latestSubmission.timeSpent)} min
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{latestSubmission?.submittedAt
						? new Date(latestSubmission.submittedAt).toLocaleString()
						: latestSubmission?.startedAt
							? `Started: ${new Date(latestSubmission.startedAt).toLocaleString()}`
							: "-"}
				</Table.Td>
			</Table.Tr>
			{hasSubmissions && (
				<Table.Tr>
					<Table.Td colSpan={7} p={0}>
						<Collapse in={opened}>
							<Box p="md">
								<Stack gap="md">
									<Text size="sm" fw={600}>
										Submission History ({submittedSubmissions.length}{" "}
										{submittedSubmissions.length === 1 ? "attempt" : "attempts"}
										)
									</Text>
									{/* sort by submittedAt descending */}
									{submittedSubmissions
										.sort((a, b) => {
											const dateA = a.submittedAt
												? new Date(a.submittedAt)
												: a.startedAt
													? new Date(a.startedAt)
													: new Date(0);
											const dateB = b.submittedAt
												? new Date(b.submittedAt)
												: b.startedAt
													? new Date(b.startedAt)
													: new Date(0);
											return dateB.getTime() - dateA.getTime();
										})
										.map((submission, index) => (
											<QuizSubmissionHistoryItem
												key={submission.id}
												attemptNumber={
													submission.attemptNumber ??
													submittedSubmissions.length - index
												}
												submission={submission}
											/>
										))}
								</Stack>
							</Box>
						</Collapse>
					</Table.Td>
				</Table.Tr>
			)}
		</>
	);
}

function StudentSubmissionRow({
	courseId,
	enrollment,
	studentSubmissions,
	isSelected,
	onSelectRow,
	canDelete,
	onDeleteSubmission,
	moduleLinkId,
	onReleaseGrade,
	isReleasing,
}: {
	courseId: number;
	enrollment: Route.ComponentProps["loaderData"]["enrollments"][number];
	studentSubmissions: SubmissionType[] | undefined;
	isSelected: boolean;
	onSelectRow: (enrollmentId: number, checked: boolean) => void;
	canDelete: boolean;
	onDeleteSubmission: (submissionId: number) => void;
	moduleLinkId: number;
	onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
	isReleasing?: boolean;
}) {
	const [opened, { toggle }] = useDisclosure(false);

	const latestSubmission = studentSubmissions?.[0];
	const email = enrollment.email || "-";

	// Sort submissions by attempt number (newest first)
	const sortedSubmissions = studentSubmissions
		? [...studentSubmissions].sort((a, b) => {
			const attemptA = a.attemptNumber || 0;
			const attemptB = b.attemptNumber || 0;
			return attemptB - attemptA;
		})
		: [];

	// Filter out draft submissions for display
	const submittedSubmissions = sortedSubmissions.filter(
		(sub) => sub.status !== "draft",
	);

	const hasSubmissions = submittedSubmissions.length > 0;

	return (
		<>
			<Table.Tr>
				<Table.Td>
					<Checkbox
						aria-label="Select row"
						checked={isSelected}
						onChange={(event) =>
							onSelectRow(enrollment.id, event.currentTarget.checked)
						}
					/>
				</Table.Td>
				<Table.Td>
					<Group gap="xs" wrap="nowrap">
						{hasSubmissions && (
							<ActionIcon
								variant="subtle"
								size="sm"
								onClick={toggle}
								aria-label={opened ? "Collapse" : "Expand"}
							>
								{opened ? (
									<IconChevronDown size={16} />
								) : (
									<IconChevronRight size={16} />
								)}
							</ActionIcon>
						)}
						{!hasSubmissions && <Box style={{ width: 28 }} />}
						<div>
							<Anchor
								component={Link}
								to={
									href("/course/:courseId/participants/profile", {
										courseId: String(courseId),
									}) + `?userId=${enrollment.userId}`
								}
								size="sm"
							>
								{enrollment.name}
							</Anchor>
						</div>
					</Group>
				</Table.Td>
				<Table.Td>{email}</Table.Td>
				<Table.Td>
					{latestSubmission && "status" in latestSubmission ? (
						<Badge
							color={
								latestSubmission.status === "graded"
									? "green"
									: latestSubmission.status === "submitted"
										? "blue"
										: "gray"
							}
							variant="light"
						>
							{latestSubmission.status === "draft"
								? "No submission"
								: latestSubmission.status}
						</Badge>
					) : (
						<Badge color="gray" variant="light">
							No submission
						</Badge>
					)}
				</Table.Td>
				<Table.Td>
					{hasSubmissions ? (
						<Text size="sm">{submittedSubmissions.length}</Text>
					) : (
						<Text size="sm" c="dimmed">
							0
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{latestSubmission &&
						"submittedAt" in latestSubmission &&
						latestSubmission.submittedAt
						? new Date(latestSubmission.submittedAt).toLocaleString()
						: "-"}
				</Table.Td>
				<Table.Td>
					<Group gap="xs">
						{hasSubmissions && latestSubmission ? (
							<Menu position="bottom-end">
								<Menu.Target>
									<ActionIcon variant="light" size="lg">
										<IconDots size={18} />
									</ActionIcon>
								</Menu.Target>
								<Menu.Dropdown>
									<Menu.Item
										component={Link}
										to={
											href("/course/module/:moduleLinkId/submissions", {
												moduleLinkId: String(moduleLinkId),
											}) +
											`?action=${AssignmentActions.GRADE_SUBMISSION}&submissionId=${latestSubmission.id}`
										}
										leftSection={<IconPencil size={14} />}
									>
										Grade
									</Menu.Item>
									{latestSubmission.grade &&
										latestSubmission.grade.baseGrade !== null &&
										latestSubmission.grade.baseGrade !== undefined &&
										onReleaseGrade && (
											<Menu.Item
												leftSection={<IconSend size={14} />}
												onClick={() => {
													onReleaseGrade(moduleLinkId, enrollment.id);
												}}
												disabled={isReleasing}
											>
												{isReleasing ? "Releasing..." : "Release Grade"}
											</Menu.Item>
										)}
								</Menu.Dropdown>
							</Menu>
						) : (
							<Button size="xs" variant="light" disabled>
								Actions
							</Button>
						)}
					</Group>
				</Table.Td>
			</Table.Tr>
			{hasSubmissions && (
				<Table.Tr>
					<Table.Td colSpan={8} p={0}>
						<Collapse in={opened}>
							<Box p="md">
								<Stack gap="md">
									<Text size="sm" fw={600}>
										Submission History ({submittedSubmissions.length}{" "}
										{submittedSubmissions.length === 1 ? "attempt" : "attempts"}
										)
									</Text>
									{/* sort by submittedAt ascending */}
									{submittedSubmissions
										.sort((a, b) => {
											const dateA = a.submittedAt
												? new Date(a.submittedAt)
												: new Date(0);
											const dateB = b.submittedAt
												? new Date(b.submittedAt)
												: new Date(0);
											return dateB.getTime() - dateA.getTime();
										})
										.map((submission, index) => (
											<SubmissionHistoryItem
												key={submission.id}
												attemptNumber={
													submission.attemptNumber ??
													submittedSubmissions.length - index
												}
												submission={submission}
												showDelete={canDelete}
												onDelete={(submissionId) => {
													onDeleteSubmission(submissionId);
												}}
												showGrade={true}
												moduleLinkId={moduleLinkId}
											/>
										))}
								</Stack>
							</Box>
						</Collapse>
					</Table.Td>
				</Table.Tr>
			)}
		</>
	);
}

// ============================================================================
// Hooks
// ============================================================================

const useDeleteSubmission = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteSubmission = (submissionId: number, moduleLinkId: number) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());

		fetcher.submit(formData, {
			method: "DELETE",
			action: href("/course/module/:moduleLinkId/submissions", {
				moduleLinkId: moduleLinkId.toString(),
			}),
		});
	};

	return {
		deleteSubmission,
		isDeleting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useGradeSubmission = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const gradeSubmission = (
		submissionId: number,
		score: number,
		feedback?: string,
	) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("score", score.toString());
		if (feedback) {
			formData.append("feedback", feedback);
		}

		fetcher.submit(formData, {
			method: "POST",
		});
	};

	return {
		gradeSubmission,
		isGrading: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useReleaseGrade = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const releaseGrade = (courseModuleLinkId: number, enrollmentId: number) => {
		const formData = new FormData();
		formData.append("courseModuleLinkId", String(courseModuleLinkId));
		formData.append("enrollmentId", String(enrollmentId));
		fetcher.submit(formData, {
			method: "PUT",
		});
	};

	return {
		releaseGrade,
		isReleasing: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

// ============================================================================
// Main Component
// ============================================================================

export default function ModuleSubmissionsPage({
	loaderData,
}: Route.ComponentProps) {
	const {
		module,
		moduleLinkId,
		moduleSettings,
		course,
		enrollments,
		submissions,
		canDelete,
		gradingSubmission,
		action,
	} = loaderData;

	// Call hooks unconditionally at the top
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const { deleteSubmission } = useDeleteSubmission();
	const clipboard = useClipboard({ timeout: 2000 });
	const { releaseGrade, isReleasing, data: releaseData } = useReleaseGrade();

	// Show notification when grade is successfully released
	useEffect(() => {
		if (
			releaseData &&
			"success" in releaseData &&
			releaseData.success &&
			"released" in releaseData &&
			releaseData.released
		) {
			notifications.show({
				title: "Success",
				message: "Grade released successfully",
				color: "green",
			});
		}
	}, [releaseData]);

	// If we're in grading mode, show the grading view
	if (action === AssignmentActions.GRADE_SUBMISSION && gradingSubmission) {
		const submissionWithRelations = gradingSubmission as typeof gradingSubmission & {
			enrollment?: { id: number } | number | null;
			courseModuleLink?: { id: number } | number | null;
		};
		return (
			<GradingView
				submission={gradingSubmission}
				module={module}
				moduleSettings={moduleSettings}
				course={course}
				moduleLinkId={loaderData.moduleLinkId}
				grade={loaderData.gradingGrade}
				onReleaseGrade={releaseGrade}
				isReleasing={isReleasing}
				enrollment={submissionWithRelations.enrollment}
				courseModuleLink={submissionWithRelations.courseModuleLink}
			/>
		);
	}

	const title = `${moduleSettings?.settings.name ?? module.title} - ${module.type === "quiz" ? "Results" : "Submissions"} | ${course.title} | Paideia LMS`;

	// Create a map of submissions by student ID
	const submissionsByStudent = new Map<number, SubmissionType[]>();
	for (const submission of submissions) {
		const studentId = submission.student.id;
		if (!submissionsByStudent.has(studentId)) {
			submissionsByStudent.set(studentId, []);
		}
		submissionsByStudent.get(studentId)?.push(submission as SubmissionType);
	}

	const allRowIds = enrollments.map((e) => e.id);
	const allSelected =
		allRowIds.length > 0 && selectedRows.length === allRowIds.length;
	const someSelected = selectedRows.length > 0 && !allSelected;

	const handleSelectAll = () => {
		setSelectedRows(allSelected ? [] : allRowIds);
	};

	const handleSelectRow = (enrollmentId: number, checked: boolean) => {
		setSelectedRows(
			checked
				? [...selectedRows, enrollmentId]
				: selectedRows.filter((id) => id !== enrollmentId),
		);
	};

	// Batch actions
	const handleBatchEmailCopy = () => {
		const selectedEnrollments = enrollments.filter((e) =>
			selectedRows.includes(e.id),
		);
		const emailAddresses = selectedEnrollments
			.map((e) => e.email)
			.filter((email): email is string => email !== null && email !== undefined)
			.join(", ");

		if (emailAddresses) {
			clipboard.copy(emailAddresses);
			notifications.show({
				title: "Copied",
				message: `Copied ${selectedEnrollments.length} email address${selectedEnrollments.length !== 1 ? "es" : ""} to clipboard`,
				color: "green",
			});
		}
	};


	// Render content based on module type
	const renderSubmissions = () => {
		if (module.type === "assignment") {
			return (
				<Stack gap="md">
					{selectedRows.length > 0 && (
						<Paper withBorder p="md">
							<Group justify="space-between">
								<Group gap="md">
									<Badge size="lg" variant="filled">
										{selectedRows.length} selected
									</Badge>
									<Text size="sm" c="dimmed">
										Batch actions available
									</Text>
								</Group>
								<Group gap="xs">
									<Button
										variant="light"
										color={clipboard.copied ? "teal" : "blue"}
										leftSection={<IconMail size={16} />}
										onClick={handleBatchEmailCopy}
										size="sm"
									>
										{clipboard.copied ? "Copied!" : "Copy Emails"}
									</Button>
									<Menu position="bottom-end">
										<Menu.Target>
											<ActionIcon variant="light" size="lg">
												<IconDots size={18} />
											</ActionIcon>
										</Menu.Target>
										<Menu.Dropdown>
											<Menu.Item
												color="red"
												leftSection={<IconTrash size={16} />}
												onClick={() => console.log("Clear selection")}
											>
												Clear Selection
											</Menu.Item>
										</Menu.Dropdown>
									</Menu>
								</Group>
							</Group>
						</Paper>
					)}
					<Paper withBorder shadow="sm" p="md" radius="md">
						<ScrollArea>
							<Table highlightOnHover style={{ minWidth: 900 }}>
								<Table.Thead>
									<Table.Tr>
										<Table.Th style={{ width: 40 }}>
											<Checkbox
												aria-label="Select all rows"
												checked={allSelected}
												indeterminate={someSelected}
												onChange={handleSelectAll}
											/>
										</Table.Th>
										<Table.Th style={{ minWidth: 200 }}>Student Name</Table.Th>
										<Table.Th style={{ minWidth: 200 }}>Email</Table.Th>
										<Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
										<Table.Th style={{ minWidth: 80 }}>Attempts</Table.Th>
										<Table.Th style={{ minWidth: 180 }}>
											Latest Submission
										</Table.Th>
										<Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{enrollments.map((enrollment) => {
										const studentSubmissions = submissionsByStudent.get(
											enrollment.userId,
										);

										return (
											<StudentSubmissionRow
												key={enrollment.id}
												courseId={course.id}
												enrollment={enrollment}
												studentSubmissions={studentSubmissions}
												isSelected={selectedRows.includes(enrollment.id)}
												onSelectRow={handleSelectRow}
												canDelete={canDelete}
												onDeleteSubmission={(submissionId) => deleteSubmission(submissionId, moduleLinkId)}
												moduleLinkId={loaderData.moduleLinkId}
												onReleaseGrade={releaseGrade}
												isReleasing={isReleasing}
											/>
										);
									})}
								</Table.Tbody>
							</Table>
						</ScrollArea>
					</Paper>
				</Stack>
			);
		}

		if (module.type === "quiz") {
			// Create a map of quiz submissions by student ID
			const quizSubmissionsByStudent = new Map<number, QuizSubmissionType[]>();
			for (const submission of submissions) {
				if (
					"attemptNumber" in submission &&
					"status" in submission &&
					submission.status !== undefined
				) {
					const studentId = submission.student.id;
					if (!quizSubmissionsByStudent.has(studentId)) {
						quizSubmissionsByStudent.set(studentId, []);
					}
					quizSubmissionsByStudent
						.get(studentId)
						?.push(submission as QuizSubmissionType);
				}
			}

			// Sort submissions by attempt number (newest first) for each student
			for (const [studentId, studentSubmissions] of quizSubmissionsByStudent) {
				quizSubmissionsByStudent.set(
					studentId,
					studentSubmissions.sort((a, b) => b.attemptNumber - a.attemptNumber),
				);
			}

			return (
				<Paper withBorder shadow="sm" p="md" radius="md">
					<ScrollArea>
						<Table highlightOnHover style={{ minWidth: 900 }}>
							<Table.Thead>
								<Table.Tr>
									<Table.Th style={{ minWidth: 200 }}>Student Name</Table.Th>
									<Table.Th style={{ minWidth: 200 }}>Email</Table.Th>
									<Table.Th style={{ minWidth: 100 }}>Status</Table.Th>
									<Table.Th style={{ minWidth: 80 }}>Attempts</Table.Th>
									<Table.Th style={{ minWidth: 100 }}>Score</Table.Th>
									<Table.Th style={{ minWidth: 120 }}>Time Spent</Table.Th>
									<Table.Th style={{ minWidth: 180 }}>Latest Submission</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{enrollments.map((enrollment) => {
									const studentSubmissions =
										quizSubmissionsByStudent.get(enrollment.userId);

									return (
										<QuizStudentSubmissionRow
											key={enrollment.id}
											courseId={course.id}
											enrollment={enrollment}
											studentSubmissions={studentSubmissions}
										/>
									);
								})}
							</Table.Tbody>
						</Table>
					</ScrollArea>
				</Paper>
			);
		}

		if (module.type === "discussion") {
			return (
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Group justify="center" align="center" style={{ minHeight: 200 }}>
						<div style={{ textAlign: "center" }}>
							<Title order={3} c="dimmed" mb="md">
								Discussion Submissions
							</Title>
							<Text c="dimmed">Discussion submissions view coming soon...</Text>
						</div>
					</Group>
				</Paper>
			);
		}

		return null;
	};

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta name="description" content={`${module.title} submissions`} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={`${module.title} submissions`} />

			{renderSubmissions()}
		</Container>
	);
}
