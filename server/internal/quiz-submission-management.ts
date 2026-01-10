import { QuizSubmissions } from "server/collections";
import type { LatestCourseQuizSettings } from "server/json/course-module-settings/version-resolver";
import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";
import type { TypedQuestionAnswer } from "server/json/raw-quiz-config/v2";
import {
	convertQuestionAnswerToDatabaseFormat,
	findQuestionInConfig,
	validateAnswerTypeMatchesQuestion,
} from "./utils/quiz-answer-converter";
import { calculateQuizGrade, type QuizAnswer } from "./quiz-grading";
import { JobQueue } from "../utils/job-queue";
import type { QuizSubmission } from "server/payload-types";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingQuizSubmissionError,
	QuizTimeLimitExceededError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryCreateUserGrade } from "./user-grade-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	assertTimeLimit,
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { tryFindCourseActivityModuleLinkById } from "./course-activity-module-link-management";

/**
 * Common arguments for quiz question operations
 */
interface TryValidateQuizQuestionOperationArgs
	extends BaseInternalFunctionArgs {
	submissionId: number;
	questionId: string;
}

/**
 * Validates and fetches all necessary data for quiz question operations
 * This is a common utility used by tryAnswerQuizQuestion, tryRemoveAnswerFromQuizQuestion,
 * tryFlagQuizQuestion, and tryUnflagQuizQuestion
 */
function tryValidateQuizQuestionOperation(
	args: TryValidateQuizQuestionOperationArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!submissionId) {
				throw new InvalidArgumentError("Submission ID is required");
			}
			if (!questionId) {
				throw new InvalidArgumentError("Question ID is required");
			}

			// Get the current submission (read operation - outside transaction)
			const currentSubmission = await payload
				.findByID({
					collection: "quiz-submissions",
					id: submissionId,
					req,
					depth: 1,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">());

			if (currentSubmission.status !== "in_progress") {
				throw new InvalidArgumentError(
					"Only in-progress submissions can be updated",
				);
			}

			// Get course module link to access quiz config (read operation - outside transaction)
			const courseModuleLink = await tryFindCourseActivityModuleLinkById({
				payload,
				linkId: currentSubmission.courseModuleLink.id,
				req,
				overrideAccess,
			}).getOrThrow();

			if (courseModuleLink.activityModule.type !== "quiz") {
				throw new InvalidArgumentError("Quiz not found");
			}

			const rawConfig = courseModuleLink.activityModule.rawQuizConfig;

			if (!rawConfig) {
				throw new InvalidArgumentError("Quiz configuration not found");
			}

			// Check time limit if quiz has one
			assertTimeLimit({
				startedAt: currentSubmission.startedAt,
				globalTimer: rawConfig?.globalTimer,
			});

			// Find the question in the quiz config (in-memory operation)
			// Verify the question exists in the quiz
			const question = findQuestionInConfig(rawConfig, questionId);

			if (!question) {
				throw new InvalidArgumentError(
					`Question with id '${questionId}' not found in quiz`,
				);
			}

			return {
				currentSubmission,
				courseModuleLink,
				rawConfig,
				question,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to validate quiz question operation", {
				cause: error,
			}),
	);
}

export interface CreateQuizArgs extends BaseInternalFunctionArgs {
	title: string;
	description?: string;
	instructions?: string;
	rawQuizConfig?: unknown;
	createdBy: number;
}

export interface UpdateQuizArgs extends BaseInternalFunctionArgs {
	id: number;
	title?: string;
	description?: string;
	instructions?: string;
	rawQuizConfig?: unknown;
}

export interface StartQuizAttemptArgs extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
	attemptNumber?: number;
}

export interface AnswerQuizQuestionArgs extends BaseInternalFunctionArgs {
	submissionId: number;
	questionId: string;
	answer: TypedQuestionAnswer;
}

export interface RemoveAnswerFromQuizQuestionArgs
	extends BaseInternalFunctionArgs {
	submissionId: number;
	questionId: string;
}

export interface FlagQuizQuestionArgs extends BaseInternalFunctionArgs {
	submissionId: number;
	questionId: string;
}

export interface UnflagQuizQuestionArgs extends BaseInternalFunctionArgs {
	submissionId: number;
	questionId: string;
}

export interface GradeQuizSubmissionArgs extends BaseInternalFunctionArgs {
	id: number;
	enrollmentId: number;
	gradebookItemId: number;
	gradedBy: number;
	submittedAt?: string | number;
}

export interface GetQuizByIdArgs extends BaseInternalFunctionArgs {
	id: number | string;
}

export interface GetQuizSubmissionByIdArgs extends BaseInternalFunctionArgs {
	id: number | string;
}

export interface ListQuizSubmissionsArgs extends BaseInternalFunctionArgs {
	courseModuleLinkId?: number;
	/**
	 * The student ID to filter by. If not provided, all students will be included.
	 */
	studentId?: number;
	enrollmentId?: number;
	status?: "in_progress" | "completed" | "graded" | "returned";
	limit?: number;
	page?: number;
}

export interface CheckInProgressSubmissionArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
	studentId: number;
}

export interface GetNextAttemptNumberArgs extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
	studentId: number;
}

export interface MarkQuizAttemptAsCompleteArgs
	extends BaseInternalFunctionArgs {
	submissionId: number;
	// answers?: Array<{
	// 	questionId: string;
	// 	questionText: string;
	// 	questionType:
	// 		| "multiple_choice"
	// 		| "true_false"
	// 		| "short_answer"
	// 		| "essay"
	// 		| "fill_blank";
	// 	selectedAnswer?: string;
	// 	multipleChoiceAnswers?: Array<{
	// 		option: string;
	// 		isSelected: boolean;
	// 	}>;
	// }>;
	// timeSpent?: number;
	/**
	 * If true, bypasses the time limit check (useful for auto-submit)
	 */
	bypassTimeLimit?: boolean;
}

export interface QuizGradingResult {
	totalScore: number;
	maxScore: number;
	percentage: number;
	questionResults: Array<{
		questionId: string;
		questionText: string;
		questionType: string;
		pointsEarned: number;
		maxPoints: number;
		isCorrect: boolean;
		feedback: string;
		correctAnswer?: string | null;
		explanation?: string | null;
	}>;
	feedback: string;
}

export interface GetQuizGradesReportArgs extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
}

export interface QuizGradesReport {
	courseModuleLinkId: number;
	quiz: {
		id: number;
		title: string;
		maxScore: number;
		questions: Array<{
			id: string;
			questionText: string;
			questionType: string;
			maxPoints: number;
		}>;
	};
	attempts: Array<{
		submissionId: number;
		student: {
			id: number;
			firstName: string;
			lastName: string;
			email: string;
		};
		attemptNumber: number;
		status: "in_progress" | "completed" | "graded" | "returned";
		startedAt: string | null;
		submittedAt: string | null;
		timeSpent: number | null;
		totalScore: number | null;
		maxScore: number | null;
		percentage: number | null;
		questionScores: Array<{
			questionId: string;
			pointsEarned: number;
			maxPoints: number;
			isCorrect: boolean | null;
		}>;
	}>;
	averages: {
		overallAverage: number;
		overallAverageCount: number;
		questionAverages: Array<{
			questionId: string;
			averageScore: number;
			count: number;
		}>;
	};
}

export interface GetQuizStatisticsReportArgs extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
}

export interface QuizStatisticsReport {
	courseModuleLinkId: number;
	quiz: {
		id: number;
		title: string;
		totalQuestions: number;
		maxScore: number;
	};
	overallStats: {
		totalAttempts: number;
		completedAttempts: number;
		averageScore: number;
		averagePercentage: number;
	};
	questionStatistics: Array<{
		questionId: string;
		questionText: string;
		questionType: string;
		maxPoints: number;
		totalAttempts: number;
		answeredCount: number;
		correctCount: number;
		incorrectCount: number;
		averageScore: number;
		difficulty: number; // percentage who got it correct (0-100)
		responseDistribution?: Array<{
			option: string;
			count: number;
			percentage: number;
		}>; // For multiple choice questions
	}>;
}

/**
 * Creates a new quiz
 */
export function tryCreateQuiz(args: CreateQuizArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				title,
				description,
				instructions,
				rawQuizConfig,
				createdBy,
				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!title) {
				throw new InvalidArgumentError("Quiz title is required");
			}
			if (!createdBy) {
				throw new InvalidArgumentError("Created by user ID is required");
			}

			const quiz = await payload
				.create({
					collection: "quizzes",
					data: {
						title,
						description,
						instructions,
						rawQuizConfig: rawQuizConfig as { [x: string]: unknown },
						createdBy,
					},
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryCreateQuiz",
						args,
					});
					throw error;
				});

			return quiz;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create quiz", {
				cause: error,
			}),
	);
}

/**
 * Gets a quiz by ID
 */
export function tryGetQuizById(args: GetQuizByIdArgs) {
	return Result.try(
		async () => {
			const { payload, id, req, overrideAccess = false } = args;

			// Validate ID
			if (!id) {
				throw new InvalidArgumentError("Quiz ID is required");
			}

			// Fetch the quiz
			const quiz = await payload
				.findByID({
					collection: "quizzes",
					id,
					depth: 1, // Fetch related data
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryGetQuizById",
						args,
					});
					throw error;
				});

			return quiz;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get quiz", {
				cause: error,
			}),
	);
}

/**
 * Updates a quiz
 */
export function tryUpdateQuiz(args: UpdateQuizArgs) {
	return Result.try(
		async () => {
			const { payload } = args;
			const {
				id,
				title,
				description,
				instructions,
				rawQuizConfig,
				req,
				overrideAccess = false,
			} = args;

			// Validate ID
			if (!id) {
				throw new InvalidArgumentError("Quiz ID is required");
			}

			// Build update data object
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (instructions !== undefined) updateData.instructions = instructions;
			if (rawQuizConfig !== undefined) updateData.rawQuizConfig = rawQuizConfig;

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			const updatedQuiz = await payload
				.update({
					collection: "quizzes",
					id,
					data: updateData,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryUpdateQuiz",
						args,
					});
					throw error;
				});

			return updatedQuiz;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update quiz", {
				cause: error,
			}),
	);
}

/**
 * Starts a new quiz attempt by creating an in_progress submission
 * This is used when a student clicks "Start Quiz" button
 */
export function tryStartQuizAttempt(args: StartQuizAttemptArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,
				enrollmentId,
				attemptNumber = 1,
				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}
			if (!studentId) {
				throw new InvalidArgumentError("Student ID is required");
			}
			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			// Check if there's an existing in_progress submission for this student and quiz
			const existingInProgressSubmission = await payload
				.find({
					collection: "quiz-submissions",
					where: {
						and: [
							{ courseModuleLink: { equals: courseModuleLinkId } },
							{ student: { equals: studentId } },
							{
								status: {
									equals: "in_progress" satisfies QuizSubmission["status"],
								},
							},
						],
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			if (existingInProgressSubmission.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot start a new quiz attempt while another attempt is in progress. Please complete or submit your current attempt first.",
				);
			}

			// Check if submission already exists for this attempt number
			const existingSubmission = await payload
				.find({
					collection: "quiz-submissions",
					where: {
						and: [
							{ courseModuleLink: { equals: courseModuleLinkId } },
							{ student: { equals: studentId } },
							{ attemptNumber: { equals: attemptNumber } },
						],
					},
					depth: 1,

					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			if (existingSubmission.docs.length > 0) {
				throw new InvalidArgumentError(
					`Submission already exists for attempt ${attemptNumber}`,
				);
			}

			// Get course module link to access quiz
			const courseModuleLink = await payload
				.findByID({
					collection: "course-activity-module-links",
					id: courseModuleLinkId,
					depth: 2, // Need to get activity module and quiz
				})
				.then(stripDepth<2, "findByID">());

			if (!courseModuleLink) {
				throw new InvalidArgumentError("Course module link not found");
			}

			// Get quiz from activity module
			const activityModule = courseModuleLink.activityModule;

			const quiz = activityModule.quiz;
			const quizSettings =
				courseModuleLink.settings as unknown as LatestCourseQuizSettings | null;

			const isLate = quizSettings?.closingTime
				? new Date() > new Date(quizSettings.closingTime)
				: false;

			// ! for now, we don't allow any late submissions for quiz
			if (isLate) {
				throw new QuizTimeLimitExceededError("Quiz is closed");
			}

			const startedAt = new Date().toISOString();

			const submission = await payload
				.create({
					collection: "quiz-submissions",
					data: {
						courseModuleLink: courseModuleLinkId,
						student: studentId,
						enrollment: enrollmentId,
						attemptNumber,
						status: "in_progress",
						startedAt,
						answers: [],
						isLate,
					},
					depth: 1,

					req,
					overrideAccess,
				})
				.then(stripDepth<1, "create">());

			// Schedule auto-submit job if quiz has a time limit
			if (quiz) {
				const rawConfig =
					quiz.rawQuizConfig as unknown as LatestQuizConfig | null;
				const globalTimer = rawConfig?.globalTimer;

				if (globalTimer && globalTimer > 0) {
					// Calculate when the timer will expire (startedAt + globalTimer seconds)
					const expirationTime = new Date(
						new Date(startedAt).getTime() + globalTimer * 1000,
					);

					// Schedule the auto-submit job
					// Only schedule if req is available (for job scheduling)
					if (req) {
						try {
							await payload.jobs.queue({
								task: "autoSubmitQuiz",
								input: {
									submissionId: submission.id,
								},
								waitUntil: expirationTime,
								queue: JobQueue.SECONDLY, // Use "secondly" queue which runs every second to process waitUntil jobs
							});
						} catch (error) {
							// Log error but don't fail the quiz start
							payload.logger.warn(
								`Failed to schedule auto-submit job for submission ${submission.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}
				}
			}

			return {
				...submission,
				courseModuleLink: submission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to start quiz attempt", {
				cause: error,
			}),
	);
}

/**
 * Answers a quiz question by updating the submission's answers array
 * This function handles validation, time limit checking, and atomic updates
 */
export function tryAnswerQuizQuestion(args: AnswerQuizQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				questionId,
				answer,
				req,
				overrideAccess = false,
			} = args;

			// Validate and fetch common data
			const { currentSubmission, question } =
				await tryValidateQuizQuestionOperation({
					payload,
					submissionId,
					questionId,
					req,
					overrideAccess,
				}).getOrThrow();

			// Validate answer type matches question type (in-memory operation)
			if (!validateAnswerTypeMatchesQuestion(question, answer)) {
				throw new InvalidArgumentError(
					`Answer type "${answer.type}" does not match question type "${question.type}"`,
				);
			}

			// Convert answer to database format (in-memory operation)
			// Pass questionId to preserve nested quiz format (e.g., "nestedQuizId:questionId")
			const dbAnswer = convertQuestionAnswerToDatabaseFormat(
				question,
				answer,
				questionId,
			);

			// Get current answers array
			const currentAnswers = currentSubmission.answers || [];

			// Find existing answer for this question (if any)
			const existingAnswerIndex = currentAnswers.findIndex(
				(a) => a.questionId === questionId,
			);

			// Update or insert the answer
			const updatedAnswers = [...currentAnswers];
			if (existingAnswerIndex >= 0) {
				// Update existing answer
				updatedAnswers[existingAnswerIndex] = dbAnswer;
			} else {
				// Add new answer
				updatedAnswers.push(dbAnswer);
			}

			// Update the submission with new answers array (only mutation - single operation, no transaction needed)
			const updatedSubmission = await payload
				.update({
					collection: "quiz-submissions",
					id: submissionId,
					data: {
						answers: updatedAnswers,
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			return {
				...updatedSubmission,
				courseModuleLink: updatedSubmission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to answer quiz question", {
				cause: error,
			}),
	);
}

/**
 * Removes an answer from a quiz question by removing it from the submission's answers array
 * This function allows users to manually remove/unanswer a question, effectively marking it as unanswered
 * It performs the same validations as tryAnswerQuizQuestion but removes the answer instead of adding/updating it
 */
export function tryRemoveAnswerFromQuizQuestion(
	args: RemoveAnswerFromQuizQuestionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess = false,
			} = args;

			// Validate and fetch common data
			const { currentSubmission } = await tryValidateQuizQuestionOperation({
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess,
			}).getOrThrow();

			// Get current answers array
			const currentAnswers = currentSubmission.answers || [];

			// Find existing answer for this question (if any)
			const existingAnswerIndex = currentAnswers.findIndex(
				(a) => a.questionId === questionId,
			);

			// If no answer exists, there's nothing to remove - return success
			if (existingAnswerIndex === -1) {
				return {
					...currentSubmission,
					courseModuleLink: currentSubmission.courseModuleLink.id,
				};
			}

			// Remove the answer from the array
			const updatedAnswers = [...currentAnswers];
			updatedAnswers.splice(existingAnswerIndex, 1);

			// Update the submission with updated answers array (only mutation - single operation, no transaction needed)
			const updatedSubmission = await payload
				.update({
					collection: "quiz-submissions",
					id: submissionId,
					data: {
						answers: updatedAnswers,
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			return {
				...updatedSubmission,
				courseModuleLink: updatedSubmission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove answer from quiz question", {
				cause: error,
			}),
	);
}

/**
 * Flags a quiz question by adding it to the submission's flaggedQuestions array
 * This function allows students to mark questions for review during the quiz attempt
 * It performs the same validations as tryAnswerQuizQuestion but adds the question to flagged list
 */
export function tryFlagQuizQuestion(args: FlagQuizQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess = false,
			} = args;

			// Validate and fetch common data
			const { currentSubmission } = await tryValidateQuizQuestionOperation({
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess,
			}).getOrThrow();

			// Get current flagged questions array
			const currentFlaggedQuestions = currentSubmission.flaggedQuestions || [];

			// Check if question is already flagged
			const isAlreadyFlagged = currentFlaggedQuestions.some(
				(flagged) => flagged.questionId === questionId,
			);

			// If already flagged, return success (idempotent)
			if (isAlreadyFlagged) {
				return {
					...currentSubmission,
					courseModuleLink: currentSubmission.courseModuleLink.id,
				};
			}

			// Add the question to flagged list
			const updatedFlaggedQuestions = [
				...currentFlaggedQuestions,
				{ questionId },
			];

			// Update the submission with updated flagged questions array (only mutation - single operation, no transaction needed)
			const updatedSubmission = await payload
				.update({
					collection: "quiz-submissions",
					id: submissionId,
					data: {
						flaggedQuestions: updatedFlaggedQuestions,
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			return {
				...updatedSubmission,
				courseModuleLink: updatedSubmission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to flag quiz question", {
				cause: error,
			}),
	);
}

/**
 * Unflags a quiz question by removing it from the submission's flaggedQuestions array
 * This function allows students to remove the flag from a question they previously flagged
 * It performs the same validations as tryFlagQuizQuestion but removes the question from flagged list
 */
export function tryUnflagQuizQuestion(args: UnflagQuizQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess = false,
			} = args;

			// Validate and fetch common data
			const { currentSubmission } = await tryValidateQuizQuestionOperation({
				payload,
				submissionId,
				questionId,
				req,
				overrideAccess,
			}).getOrThrow();

			// Get current flagged questions array
			const currentFlaggedQuestions = currentSubmission.flaggedQuestions || [];

			// Find existing flagged question index (if any)
			const existingFlaggedIndex = currentFlaggedQuestions.findIndex(
				(flagged) => flagged.questionId === questionId,
			);

			// If no flag exists, there's nothing to remove - return success (idempotent)
			if (existingFlaggedIndex === -1) {
				return {
					...currentSubmission,
					courseModuleLink: currentSubmission.courseModuleLink.id,
				};
			}

			// Remove the flag from the array
			const updatedFlaggedQuestions = [...currentFlaggedQuestions];
			updatedFlaggedQuestions.splice(existingFlaggedIndex, 1);

			// Update the submission with updated flagged questions array (only mutation - single operation, no transaction needed)
			const updatedSubmission = await payload
				.update({
					collection: "quiz-submissions",
					id: submissionId,
					data: {
						flaggedQuestions: updatedFlaggedQuestions,
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			return {
				...updatedSubmission,
				courseModuleLink: updatedSubmission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to unflag quiz question", {
				cause: error,
			}),
	);
}

/**
 * Gets a quiz submission by ID
 */
export function tryGetQuizSubmissionById(args: GetQuizSubmissionByIdArgs) {
	return Result.try(
		async () => {
			const { payload, id, req, overrideAccess = false } = args;

			// Validate ID
			if (!id) {
				throw new InvalidArgumentError("Quiz submission ID is required");
			}

			// Fetch the quiz submission
			const submissionResult = await payload
				.find({
					collection: "quiz-submissions",
					where: {
						and: [
							{
								id: { equals: id },
							},
						],
					},
					depth: 1, // Fetch related data

					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			const submission = submissionResult.docs[0];

			if (!submission) {
				throw new NonExistingQuizSubmissionError(
					`Quiz submission with id '${id}' not found`,
				);
			}

			return {
				...submission,
				courseModuleLink: submission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get quiz submission", {
				cause: error,
			}),
	);
}

/**
 * Submits a quiz (marks as completed)
 */
export function tryMarkQuizAttemptAsComplete(
	args: MarkQuizAttemptAsCompleteArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				submissionId,
				req,
				overrideAccess = false,
				bypassTimeLimit = false,
			} = args;

			// Validate ID
			if (!submissionId) {
				throw new InvalidArgumentError("Quiz submission ID is required");
			}

			// Get the current submission
			const currentSubmission = await payload
				.findByID({
					collection: "quiz-submissions",
					id: submissionId,
					req,
					depth: 1,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">());

			if (currentSubmission.status !== "in_progress") {
				throw new InvalidArgumentError(
					"Only in-progress submissions can be submitted",
				);
			}

			// Check time limit if quiz has one (unless bypassed for auto-submit)
			if (!bypassTimeLimit) {
				// Get course module link to access quiz time limit
				const courseModuleLink = await tryFindCourseActivityModuleLinkById({
					payload,
					linkId: currentSubmission.courseModuleLink.id,
					req,
					overrideAccess,
				}).getOrThrow();

				if (courseModuleLink.activityModule.type !== "quiz") {
					throw new InvalidArgumentError("Quiz not found");
				}

				// Get globalTimer from rawQuizConfig
				const rawConfig = courseModuleLink.activityModule.rawQuizConfig;

				// Use utility function to check time limit
				assertTimeLimit({
					startedAt: currentSubmission.startedAt,
					globalTimer: rawConfig?.globalTimer,
					bypassTimeLimit,
				});
			}

			// Calculate timeSpent automatically from startedAt to now
			let timeSpent: number | undefined;
			if (currentSubmission.startedAt) {
				const startedAt = new Date(currentSubmission.startedAt);
				const now = new Date();
				timeSpent = (now.getTime() - startedAt.getTime()) / (1000 * 60); // Convert to minutes
			}

			// Update status to completed
			const updatedSubmission = await payload
				.update({
					collection: "quiz-submissions",
					id: submissionId,
					data: {
						status: "completed",
						submittedAt: new Date().toISOString(),
						...(timeSpent !== undefined && { timeSpent }),
					},

					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">());

			return {
				...updatedSubmission,
				courseModuleLink: updatedSubmission.courseModuleLink.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to submit quiz", {
				cause: error,
			}),
	);
}

type CalculateQuizGradeArgs = BaseInternalFunctionArgs & {
	quizId: number;
	answers: Array<{
		questionId: string;
		questionText: string;
		questionType:
			| "multiple_choice"
			| "true_false"
			| "short_answer"
			| "essay"
			| "fill_blank";
		selectedAnswer?: string | null;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}>;
};

/**
 * Calculates quiz grade based on answers and correct answers
 * Uses the pure calculateQuizGrade function internally
 */
export function tryCalculateQuizGrade(args: CalculateQuizGradeArgs) {
	return Result.try(
		async () => {
			const { payload, quizId, answers, req, overrideAccess = false } = args;

			// Get the quiz to access correct answers
			const quiz = await payload.findByID({
				collection: "quizzes",
				id: quizId,
				req,
				overrideAccess,
			});

			if (!quiz) {
				throw new InvalidArgumentError("Quiz not found");
			}

			// Extract questions from rawQuizConfig
			const rawConfig = quiz.rawQuizConfig as LatestQuizConfig | null;

			if (!rawConfig || typeof rawConfig !== "object") {
				throw new InvalidArgumentError(
					"Quiz rawQuizConfig is required for grading",
				);
			}

			// Use the pure grading function
			return calculateQuizGrade(rawConfig, answers as QuizAnswer[]);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to calculate quiz grade", {
				cause: error,
			}),
	);
}

/**
 * Grades a quiz submission automatically and creates gradebook entry
 */
export function tryGradeQuizSubmission(args: GradeQuizSubmissionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				id,
				enrollmentId,
				gradebookItemId,
				gradedBy,
				submittedAt,
				req,
				overrideAccess = false,
			} = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				// Get the current submission
				const currentSubmission = await payload
					.findByID({
						collection: QuizSubmissions.slug,
						id,
						req: reqWithTransaction,

						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "findByID">())
					.catch((error) => {
						interceptPayloadError({
							error,
							functionNamePrefix: "tryGradeQuizSubmission",
							args,
						});
						throw error;
					});

				if (!currentSubmission) {
					throw new NonExistingQuizSubmissionError(
						`Quiz submission with id '${id}' not found`,
					);
				}

				if (currentSubmission.status !== "completed") {
					throw new InvalidArgumentError(
						"Only completed quiz submissions can be graded",
					);
				}

				// Get course module link to access quiz
				const courseModuleLink = await payload
					.findByID({
						collection: "course-activity-module-links",
						id: currentSubmission.courseModuleLink,
						depth: 2,
						req: transactionInfo.reqWithTransaction,

						overrideAccess,
					})
					.then(stripDepth<2, "findByID">());

				if (!courseModuleLink) {
					throw new InvalidArgumentError("Course module link not found");
				}

				const activityModule = courseModuleLink.activityModule;
				const quiz = activityModule.quiz;

				if (!quiz) {
					throw new InvalidArgumentError("Quiz not found");
				}

				// Calculate the grade
				const validAnswers = (currentSubmission.answers ?? [])
					.filter((answer) => answer.questionText)
					.map((answer) => ({
						questionId: answer.questionId,
						questionText: answer.questionText as string,
						questionType: answer.questionType,
						selectedAnswer: answer.selectedAnswer,
						multipleChoiceAnswers: answer.multipleChoiceAnswers
							?.filter(
								(choice) =>
									choice.option && typeof choice.isSelected === "boolean",
							)
							.map((choice) => ({
								option: choice.option,
								isSelected: choice.isSelected as boolean,
							})),
					}));

				const gradingResult = await tryCalculateQuizGrade({
					payload,
					quizId: quiz.id,
					answers: validAnswers,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});

				if (!gradingResult.ok) {
					throw new Error(
						`Failed to calculate quiz grade: ${gradingResult.error}`,
					);
				}

				const gradeData = gradingResult.value;

				// Update submission with grade
				const updatedSubmission = await payload
					.update({
						collection: QuizSubmissions.slug,
						id,
						data: {
							status: "graded",
							totalScore: gradeData.totalScore,
							maxScore: gradeData.maxScore,
							percentage: gradeData.percentage,
							autoGraded: true,
						},
						depth: 1,
						req: transactionInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "update">());

				// Create user grade in gradebook
				const submittedAtString =
					submittedAt !== undefined
						? String(submittedAt)
						: updatedSubmission.submittedAt !== undefined
							? String(updatedSubmission.submittedAt)
							: undefined;
				const userGradeResult = await tryCreateUserGrade({
					payload,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
					enrollmentId,
					gradebookItemId,
					baseGrade: gradeData.totalScore,
					baseGradeSource: "submission",
					submission: id,
					submissionType: "quiz",
					feedback: gradeData.feedback,
					gradedBy,
					submittedAt: submittedAtString,
				});

				if (!userGradeResult.ok) {
					throw new Error(
						`Failed to create gradebook entry: ${userGradeResult.error}`,
					);
				}
				payload.logger.info("User grade created successfully");

				return {
					...updatedSubmission,
					courseModuleLink: updatedSubmission.courseModuleLink.id,
					grade: gradeData.totalScore,
					maxGrade: gradeData.maxScore,
					percentage: gradeData.percentage,
					feedback: gradeData.feedback,
					gradedBy,
					userGrade: userGradeResult.value,
					questionResults: gradeData.questionResults,
				};
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to grade quiz submission", {
				cause: error,
			}),
	);
}

/**
 * Lists quiz submissions with filtering
 */
export function tryListQuizSubmissions(args: ListQuizSubmissionsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,
				enrollmentId,
				status,
				limit = 10,
				page = 1,

				req,
				overrideAccess = false,
			} = args;

			const whereConditions: Array<Record<string, { equals: unknown }>> = [];

			if (courseModuleLinkId) {
				whereConditions.push({
					courseModuleLink: { equals: courseModuleLinkId },
				});
			}

			if (studentId) {
				whereConditions.push({
					student: { equals: studentId },
				});
			}

			if (enrollmentId) {
				whereConditions.push({
					enrollment: { equals: enrollmentId },
				});
			}

			if (status) {
				whereConditions.push({
					status: { equals: status },
				});
			}

			const where =
				whereConditions.length > 0 ? { and: whereConditions } : undefined;

			const result = await payload
				.find({
					collection: "quiz-submissions",
					where,
					limit,
					page,
					sort: "-createdAt",
					depth: 1, // Fetch related data

					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			// type narrowing
			const docs = result.docs.map((doc) => {
				return {
					...doc,
					courseModuleLink: doc.courseModuleLink.id,
					student: doc.student,
					enrollment: doc.enrollment,
				};
			});

			return {
				docs,
				totalDocs: result.totalDocs,
				totalPages: result.totalPages,
				page: result.page,
				limit: result.limit,
				hasNextPage: result.hasNextPage,
				hasPrevPage: result.hasPrevPage,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to list quiz submissions", {
				cause: error,
			}),
	);
}

/**
 * Checks if there's an in_progress submission for a student and quiz
 */
export function tryCheckInProgressSubmission(
	args: CheckInProgressSubmissionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,

				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}
			if (!studentId) {
				throw new InvalidArgumentError("Student ID is required");
			}

			const result = await payload.find({
				collection: "quiz-submissions",
				where: {
					and: [
						{ courseModuleLink: { equals: courseModuleLinkId } },
						{ student: { equals: studentId } },
						{ status: { equals: "in_progress" } },
					],
				},
				limit: 1,
				req,
				overrideAccess,
			});

			return {
				hasInProgress: result.docs.length > 0,
				submission: result.docs[0] || null,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to check in-progress submission", {
				cause: error,
			}),
	);
}

/**
 * Gets the next attempt number for a student and quiz
 */
export function tryGetNextAttemptNumber(args: GetNextAttemptNumberArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,
				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}
			if (!studentId) {
				throw new InvalidArgumentError("Student ID is required");
			}

			const result = await tryListQuizSubmissions({
				payload,
				courseModuleLinkId,
				studentId,
				// Get all submissions to find max attempt number
				// ! limit 100 should be fine because we're not expecting a lot of submissions from a student
				limit: 100,
				req,
				overrideAccess,
			});

			if (!result.ok) {
				throw result.error;
			}

			const maxAttemptNumber =
				result.value.docs.length > 0
					? Math.max(...result.value.docs.map((sub) => sub.attemptNumber || 1))
					: 0;

			return maxAttemptNumber + 1;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get next attempt number", {
				cause: error,
			}),
	);
}

type TryDeleteQuizSubmissionArgs = BaseInternalFunctionArgs & {
	id: number;
};

/**
 * Deletes a quiz submission
 */
export function tryDeleteQuizSubmission(args: TryDeleteQuizSubmissionArgs) {
	return Result.try(
		async () => {
			const { payload, id, req, overrideAccess = false } = args;

			const deletedSubmission = await payload
				.delete({
					collection: "quiz-submissions",
					id,
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "delete">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: `tryDeleteQuizSubmission - to delete quiz submission by ID ${id}`,
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return deletedSubmission;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete quiz submission", {
				cause: error,
			}),
	);
}

/**
 * Gets quiz grades report for a course module
 */
export function tryGetQuizGradesReport(args: GetQuizGradesReportArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,

				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}

			// Get course module link to access quiz
			const courseModuleLink = await payload.findByID({
				collection: "course-activity-module-links",
				id: courseModuleLinkId,
				depth: 2, // Need to get activity module and quiz
				req,
				overrideAccess,
			});

			if (!courseModuleLink) {
				throw new InvalidArgumentError("Course module link not found");
			}

			// Get quiz from activity module
			const activityModule =
				typeof courseModuleLink.activityModule === "object"
					? courseModuleLink.activityModule
					: null;
			const quiz =
				activityModule && typeof activityModule.quiz === "object"
					? activityModule.quiz
					: null;

			if (!quiz || !quiz.id) {
				throw new InvalidArgumentError("Quiz not found");
			}

			// Get all submissions for this course module link
			const submissionsResult = await tryListQuizSubmissions({
				payload,
				courseModuleLinkId,
				limit: 1000, // Get all submissions
				req,
				overrideAccess,
			});

			if (!submissionsResult.ok) {
				throw submissionsResult.error;
			}

			const submissions = submissionsResult.value.docs;

			// Build quiz questions map
			const questionsMap = new Map<
				string,
				{ questionText: string; questionType: string; maxPoints: number }
			>();
			// TODO: Refactor to extract questions from rawQuizConfig v2 format
			const questions = (quiz as any).questions || [];
			for (const question of questions) {
				if (question.id) {
					questionsMap.set(question.id.toString(), {
						questionText: question.questionText,
						questionType: question.questionType,
						maxPoints: question.points,
					});
				}
			}

			// Process submissions
			const attempts: QuizGradesReport["attempts"] = [];
			const completedAttempts: Array<{
				totalScore: number;
				maxScore: number;
				questionScores: Array<{
					questionId: string;
					pointsEarned: number;
					maxPoints: number;
				}>;
			}> = [];

			for (const submission of submissions) {
				// Type narrowing for student
				const student =
					typeof submission.student === "object" ? submission.student : null;
				if (!student) {
					continue;
				}

				// Extract question scores from answers
				const questionScores: Array<{
					questionId: string;
					pointsEarned: number;
					maxPoints: number;
					isCorrect: boolean | null;
				}> = [];

				const answers = submission.answers || [];
				for (const answer of answers) {
					const question = questionsMap.get(answer.questionId);
					if (question) {
						const pointsEarned = answer.pointsEarned ?? 0;
						const maxPoints = question.maxPoints;
						questionScores.push({
							questionId: answer.questionId,
							pointsEarned,
							maxPoints,
							isCorrect: answer.isCorrect ?? null,
						});
					}
				}

				// Fill in missing questions with zero scores
				for (const [questionId, question] of questionsMap.entries()) {
					if (!questionScores.find((qs) => qs.questionId === questionId)) {
						questionScores.push({
							questionId,
							pointsEarned: 0,
							maxPoints: question.maxPoints,
							isCorrect: null,
						});
					}
				}

				// Calculate time spent if both dates are available
				let timeSpent: number | null = null;
				if (submission.startedAt && submission.submittedAt) {
					const started = new Date(submission.startedAt);
					const submitted = new Date(submission.submittedAt);
					timeSpent = Math.round(
						(submitted.getTime() - started.getTime()) / 1000 / 60,
					); // minutes
				}

				attempts.push({
					submissionId: submission.id,
					student: {
						id: student.id,
						firstName: student.firstName || "",
						lastName: student.lastName || "",
						email: student.email || "",
					},
					attemptNumber: submission.attemptNumber,
					status: submission.status,
					startedAt: submission.startedAt || null,
					submittedAt: submission.submittedAt || null,
					timeSpent,
					totalScore: submission.totalScore ?? null,
					maxScore: submission.maxScore ?? null,
					percentage: submission.percentage ?? null,
					questionScores,
				});

				// Collect completed/graded attempts for averages
				if (
					submission.status === "completed" ||
					submission.status === "graded" ||
					submission.status === "returned"
				) {
					if (
						submission.totalScore !== null &&
						submission.totalScore !== undefined &&
						submission.maxScore !== null &&
						submission.maxScore !== undefined
					) {
						completedAttempts.push({
							totalScore: submission.totalScore,
							maxScore: submission.maxScore,
							questionScores: questionScores.map((qs) => ({
								questionId: qs.questionId,
								pointsEarned: qs.pointsEarned,
								maxPoints: qs.maxPoints,
							})),
						});
					}
				}
			}

			// Calculate overall averages
			let overallAverage = 0;
			let overallAverageCount = 0;
			if (completedAttempts.length > 0) {
				const totalScoreSum = completedAttempts.reduce(
					(sum, attempt) => sum + attempt.totalScore,
					0,
				);
				overallAverage = totalScoreSum / completedAttempts.length;
				overallAverageCount = completedAttempts.length;
			}

			// Calculate per-question averages
			const questionAverages: Array<{
				questionId: string;
				averageScore: number;
				count: number;
			}> = [];

			for (const [questionId] of questionsMap.entries()) {
				const questionAttempts = completedAttempts
					.map((attempt) => {
						const qs = attempt.questionScores.find(
							(q) => q.questionId === questionId,
						);
						return qs ? qs.pointsEarned : null;
					})
					.filter((score): score is number => score !== null);

				if (questionAttempts.length > 0) {
					const averageScore =
						questionAttempts.reduce((sum, score) => sum + score, 0) /
						questionAttempts.length;
					questionAverages.push({
						questionId,
						averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimals
						count: questionAttempts.length,
					});
				}
			}

			// TODO: Refactor to calculate from rawQuizConfig using calculateTotalPoints
			const maxScore = (quiz as any).points ?? 0;

			return {
				courseModuleLinkId,
				quiz: {
					id: quiz.id,
					title: quiz.title,
					maxScore,
					questions: Array.from(questionsMap.entries()).map(([id, q]) => ({
						id,
						questionText: q.questionText,
						questionType: q.questionType,
						maxPoints: q.maxPoints,
					})),
				},
				attempts,
				averages: {
					overallAverage: Math.round(overallAverage * 100) / 100, // Round to 2 decimals
					overallAverageCount,
					questionAverages,
				},
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get quiz grades report", {
				cause: error,
			}),
	);
}

/**
 * Gets quiz statistics report for a course module
 */
export function tryGetQuizStatisticsReport(args: GetQuizStatisticsReportArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,

				req,
				overrideAccess = false,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}

			// Get course module link to access quiz
			const courseModuleLink = await payload.findByID({
				collection: "course-activity-module-links",
				id: courseModuleLinkId,
				depth: 2, // Need to get activity module and quiz
				req,
				overrideAccess,
			});

			if (!courseModuleLink) {
				throw new InvalidArgumentError("Course module link not found");
			}

			// Get quiz from activity module
			const activityModule =
				typeof courseModuleLink.activityModule === "object"
					? courseModuleLink.activityModule
					: null;
			const quiz =
				activityModule && typeof activityModule.quiz === "object"
					? activityModule.quiz
					: null;

			if (!quiz || !quiz.id) {
				throw new InvalidArgumentError("Quiz not found");
			}

			// Get all submissions for this course module link
			const submissionsResult = await tryListQuizSubmissions({
				payload,
				courseModuleLinkId,
				limit: 1000, // Get all submissions
				req,
				overrideAccess,
			});

			if (!submissionsResult.ok) {
				throw submissionsResult.error;
			}

			const submissions = submissionsResult.value.docs;
			// TODO: Refactor to extract questions from rawQuizConfig v2 format
			const questions = (quiz as any).questions || [];

			// Calculate overall statistics
			const totalAttempts = submissions.length;
			const completedAttempts = submissions.filter(
				(s) =>
					s.status === "completed" ||
					s.status === "graded" ||
					s.status === "returned",
			);

			let averageScore = 0;
			let averagePercentage = 0;
			if (completedAttempts.length > 0) {
				const scores = completedAttempts
					.map((s) => s.totalScore)
					.filter(
						(score): score is number => score !== null && score !== undefined,
					);
				const percentages = completedAttempts
					.map((s) => s.percentage)
					.filter((p): p is number => p !== null && p !== undefined);

				if (scores.length > 0) {
					averageScore =
						scores.reduce((sum, score) => sum + score, 0) / scores.length;
				}
				if (percentages.length > 0) {
					averagePercentage =
						percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
				}
			}

			// Calculate question statistics
			const questionStatistics: QuizStatisticsReport["questionStatistics"] = [];

			for (const question of questions) {
				if (!question.id) continue;

				const questionId = question.id.toString();
				let answeredCount = 0;
				let correctCount = 0;
				let incorrectCount = 0;
				const scores: number[] = [];
				const responseCounts = new Map<string, number>(); // For multiple choice

				for (const submission of submissions) {
					const answers = submission.answers || [];
					const answer = answers.find((a) => a.questionId === questionId);

					if (answer) {
						answeredCount++;
						const pointsEarned = answer.pointsEarned ?? 0;
						scores.push(pointsEarned);

						if (answer.isCorrect === true) {
							correctCount++;
						} else if (answer.isCorrect === false) {
							incorrectCount++;
						}

						// For multiple choice questions, track response distribution
						if (
							question.questionType === "multiple_choice" &&
							answer.multipleChoiceAnswers
						) {
							for (const choice of answer.multipleChoiceAnswers) {
								if (choice.isSelected) {
									const currentCount = responseCounts.get(choice.option) || 0;
									responseCounts.set(choice.option, currentCount + 1);
								}
							}
						} else if (answer.selectedAnswer) {
							// For other question types, track selected answer
							const currentCount =
								responseCounts.get(answer.selectedAnswer) || 0;
							responseCounts.set(answer.selectedAnswer, currentCount + 1);
						}
					}
				}

				const averageScore =
					scores.length > 0
						? scores.reduce((sum, score) => sum + score, 0) / scores.length
						: 0;

				const difficulty =
					answeredCount > 0
						? Math.round((correctCount / answeredCount) * 100 * 100) / 100
						: 0;

				// Build response distribution for multiple choice
				let responseDistribution:
					| Array<{
							option: string;
							count: number;
							percentage: number;
					  }>
					| undefined;

				if (
					question.questionType === "multiple_choice" &&
					responseCounts.size > 0
				) {
					responseDistribution = Array.from(responseCounts.entries()).map(
						([option, count]) => ({
							option,
							count,
							percentage: Math.round((count / answeredCount) * 100 * 100) / 100,
						}),
					);
				}

				questionStatistics.push({
					questionId,
					questionText: (question as any).questionText,
					questionType: (question as any).questionType,
					maxPoints: (question as any).points,
					totalAttempts,
					answeredCount,
					correctCount,
					incorrectCount,
					averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimals
					difficulty,
					responseDistribution,
				});
			}

			// TODO: Refactor to calculate from rawQuizConfig using calculateTotalPoints
			const maxScore = (quiz as any).points ?? 0;

			return {
				courseModuleLinkId,
				quiz: {
					id: quiz.id,
					title: quiz.title,
					totalQuestions: questions.length,
					maxScore,
				},
				overallStats: {
					totalAttempts,
					completedAttempts: completedAttempts.length,
					averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimals
					averagePercentage: Math.round(averagePercentage * 100) / 100, // Round to 2 decimals
				},
				questionStatistics,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get quiz statistics report", {
				cause: error,
			}),
	);
}
