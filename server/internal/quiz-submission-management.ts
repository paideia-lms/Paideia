import type { Payload, PayloadRequest, TypedUser } from "payload";
import { QuizSubmissions } from "server/collections";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import type { QuizSubmission } from "server/payload-types";
import { JobQueue } from "server/payload.config";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingQuizSubmissionError,
	QuizTimeLimitExceededError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryCreateUserGrade } from "./user-grade-management";

export interface CreateQuizArgs {
	title: string;
	description?: string;
	instructions?: string;
	dueDate?: string;
	maxAttempts?: number;
	allowLateSubmissions?: boolean;
	points?: number;
	gradingType?: "automatic" | "manual";
	timeLimit?: number;
	showCorrectAnswers?: boolean;
	allowMultipleAttempts?: boolean;
	shuffleQuestions?: boolean;
	shuffleAnswers?: boolean;
	showOneQuestionAtATime?: boolean;
	rawQuizConfig?: unknown;
	questions: Array<{
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank"
		| "matching"
		| "ordering";
		points: number;
		options?: Array<{
			text: string;
			isCorrect: boolean;
			feedback?: string;
		}>;
		correctAnswer?: string;
		explanation?: string;
		hints?: Array<{
			hint: string;
		}>;
	}>;
	createdBy: number;
}

export interface UpdateQuizArgs {
	id: number;
	title?: string;
	description?: string;
	instructions?: string;
	dueDate?: string;
	maxAttempts?: number;
	allowLateSubmissions?: boolean;
	points?: number;
	gradingType?: "automatic" | "manual";
	timeLimit?: number;
	showCorrectAnswers?: boolean;
	allowMultipleAttempts?: boolean;
	shuffleQuestions?: boolean;
	shuffleAnswers?: boolean;
	showOneQuestionAtATime?: boolean;
	rawQuizConfig?: unknown;
	questions?: Array<{
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank"
		| "matching"
		| "ordering";
		points: number;
		options?: Array<{
			text: string;
			isCorrect: boolean;
			feedback?: string;
		}>;
		correctAnswer?: string;
		explanation?: string;
		hints?: Array<{
			hint: string;
		}>;
	}>;
}

export interface CreateQuizSubmissionArgs {
	payload: Payload;
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
	attemptNumber?: number;
	answers: Array<{
		questionId: string;
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
		selectedAnswer?: string;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}>;
	timeSpent?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface StartQuizAttemptArgs {
	payload: Payload;
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
	attemptNumber?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateQuizSubmissionArgs {
	payload: Payload;
	id: number;
	status?: "in_progress" | "completed" | "graded" | "returned";
	answers?: Array<{
		questionId: string;
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
		selectedAnswer?: string;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}>;
	timeSpent?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GradeQuizSubmissionArgs {
	id: number;
	enrollmentId: number;
	gradebookItemId: number;
	gradedBy: number;
	submittedAt?: string | number;
}

export interface GetQuizByIdArgs {
	payload: Payload;
	id: number | string;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GetQuizSubmissionByIdArgs {
	payload: Payload;
	id: number | string;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface ListQuizSubmissionsArgs {
	payload: Payload;
	courseModuleLinkId?: number;
	/**
	 * The student ID to filter by. If not provided, all students will be included.
	 */
	studentId?: number;
	enrollmentId?: number;
	status?: "in_progress" | "completed" | "graded" | "returned";
	limit?: number;
	page?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface CheckInProgressSubmissionArgs {
	payload: Payload;
	courseModuleLinkId: number;
	studentId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface GetNextAttemptNumberArgs {
	payload: Payload;
	courseModuleLinkId: number;
	studentId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface SubmitQuizArgs {
	payload: Payload;
	submissionId: number;
	answers?: Array<{
		questionId: string;
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
		selectedAnswer?: string;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}>;
	timeSpent?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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

export interface GetQuizGradesReportArgs {
	payload: Payload;
	courseModuleLinkId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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

export interface GetQuizStatisticsReportArgs {
	payload: Payload;
	courseModuleLinkId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
export const tryCreateQuiz = Result.wrap(
	async (payload: Payload, args: CreateQuizArgs) => {
		const {
			title,
			description,
			instructions,
			dueDate,
			maxAttempts = 1,
			allowLateSubmissions = false,
			points = 100,
			gradingType = "automatic",
			// timeLimit is no longer used - it's derived from rawQuizConfig.globalTimer
			showCorrectAnswers = false,
			allowMultipleAttempts = false,
			shuffleQuestions = false,
			shuffleAnswers = false,
			showOneQuestionAtATime = false,
			rawQuizConfig,
			questions,
			createdBy,
		} = args;

		// Validate required fields
		if (!title) {
			throw new InvalidArgumentError("Quiz title is required");
		}
		if (!questions || questions.length === 0) {
			throw new InvalidArgumentError("Quiz must have at least one question");
		}
		if (!createdBy) {
			throw new InvalidArgumentError("Created by user ID is required");
		}

		// Validate questions
		for (const question of questions) {
			if (!question.questionText) {
				throw new InvalidArgumentError("Question text is required");
			}
			if (!question.questionType) {
				throw new InvalidArgumentError("Question type is required");
			}
			if (question.points <= 0) {
				throw new InvalidArgumentError(
					"Question points must be greater than 0",
				);
			}

			// Validate question-specific requirements
			if (
				question.questionType === "multiple_choice" &&
				(!question.options || question.options.length < 2)
			) {
				throw new InvalidArgumentError(
					"Multiple choice questions must have at least 2 options",
				);
			}
			if (question.questionType === "multiple_choice") {
				const correctOptions =
					question.options?.filter((opt) => opt.isCorrect) || [];
				if (correctOptions.length === 0) {
					throw new InvalidArgumentError(
						"Multiple choice questions must have at least one correct option",
					);
				}
			}
		}

		const quiz = await payload.create({
			collection: "quizzes",
			data: {
				title,
				description,
				instructions,
				dueDate,
				maxAttempts,
				allowLateSubmissions,
				points,
				gradingType,
				showCorrectAnswers,
				allowMultipleAttempts,
				shuffleQuestions,
				shuffleAnswers,
				showOneQuestionAtATime,
				rawQuizConfig: rawQuizConfig as { [x: string]: unknown },
				questions,
				createdBy,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const createdByUser = quiz.createdBy;
		assertZodInternal(
			"tryCreateQuiz: Created by user is required",
			createdByUser,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...quiz,
			createdBy: createdByUser,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create quiz", {
			cause: error,
		}),
);

/**
 * Gets a quiz by ID
 */
export const tryGetQuizById = Result.wrap(
	async (args: GetQuizByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz ID is required");
		}

		// Fetch the quiz
		const quizResult = await payload.find({
			collection: "quizzes",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth: 1, // Fetch related data
			user,
			req,
			overrideAccess,
		});

		const quiz = quizResult.docs[0];

		if (!quiz) {
			throw new InvalidArgumentError(`Quiz with id '${id}' not found`);
		}

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const createdBy = quiz.createdBy;
		assertZodInternal(
			"tryGetQuizById: Created by user is required",
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...quiz,
			createdBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get quiz", {
			cause: error,
		}),
);

/**
 * Updates a quiz
 */
export const tryUpdateQuiz = Result.wrap(
	async (payload: Payload, args: UpdateQuizArgs) => {
		const {
			id,
			title,
			description,
			instructions,
			dueDate,
			maxAttempts,
			allowLateSubmissions,
			points,
			gradingType,
			// timeLimit is no longer used - it's derived from rawQuizConfig.globalTimer
			showCorrectAnswers,
			allowMultipleAttempts,
			shuffleQuestions,
			shuffleAnswers,
			showOneQuestionAtATime,
			rawQuizConfig,
			questions,
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
		if (dueDate !== undefined) updateData.dueDate = dueDate;
		if (maxAttempts !== undefined) updateData.maxAttempts = maxAttempts;
		if (allowLateSubmissions !== undefined)
			updateData.allowLateSubmissions = allowLateSubmissions;
		if (points !== undefined) updateData.points = points;
		if (gradingType !== undefined) updateData.gradingType = gradingType;
		// timeLimit is no longer stored in the collection - it's derived from rawQuizConfig.globalTimer
		if (showCorrectAnswers !== undefined)
			updateData.showCorrectAnswers = showCorrectAnswers;
		if (allowMultipleAttempts !== undefined)
			updateData.allowMultipleAttempts = allowMultipleAttempts;
		if (shuffleQuestions !== undefined)
			updateData.shuffleQuestions = shuffleQuestions;
		if (shuffleAnswers !== undefined)
			updateData.shuffleAnswers = shuffleAnswers;
		if (showOneQuestionAtATime !== undefined)
			updateData.showOneQuestionAtATime = showOneQuestionAtATime;
		if (rawQuizConfig !== undefined) updateData.rawQuizConfig = rawQuizConfig;
		if (questions !== undefined) updateData.questions = questions;

		// Validate that at least one field is being updated
		if (Object.keys(updateData).length === 0) {
			throw new InvalidArgumentError(
				"At least one field must be provided for update",
			);
		}

		const updatedQuiz = await payload.update({
			collection: "quizzes",
			id,
			data: updateData,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const createdBy = updatedQuiz.createdBy;
		assertZodInternal(
			"tryUpdateQuiz: Created by user is required",
			createdBy,
			z.object({ id: z.number() }),
		);

		return {
			...updatedQuiz,
			createdBy,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update quiz", {
			cause: error,
		}),
);

/**
 * Deletes a quiz
 */
export const tryDeleteQuiz = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz ID is required");
		}

		// Check if quiz exists
		const existingQuiz = await payload.findByID({
			collection: "quizzes",
			id,
		});

		if (!existingQuiz) {
			throw new InvalidArgumentError(`Quiz with id '${id}' not found`);
		}

		const deletedQuiz = await payload.delete({
			collection: "quizzes",
			id,
		});

		return deletedQuiz;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete quiz", {
			cause: error,
		}),
);

/**
 * Starts a new quiz attempt by creating an in_progress submission
 * This is used when a student clicks "Start Quiz" button
 */
export const tryStartQuizAttempt = Result.wrap(
	async (args: StartQuizAttemptArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			user = null,
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
		const existingInProgressSubmission = await payload.find({
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
			user,
			req,
			overrideAccess,
		});

		if (existingInProgressSubmission.docs.length > 0) {
			throw new InvalidArgumentError(
				"Cannot start a new quiz attempt while another attempt is in progress. Please complete or submit your current attempt first.",
			);
		}

		// Check if submission already exists for this attempt number
		const existingSubmission = await payload.find({
			collection: "quiz-submissions",
			where: {
				and: [
					{ courseModuleLink: { equals: courseModuleLinkId } },
					{ student: { equals: studentId } },
					{ attemptNumber: { equals: attemptNumber } },
				],
			},
			user,
			req,
			overrideAccess,
		});

		if (existingSubmission.docs.length > 0) {
			throw new InvalidArgumentError(
				`Submission already exists for attempt ${attemptNumber}`,
			);
		}

		// Get course module link to access quiz
		const courseModuleLink = await payload.findByID({
			collection: "course-activity-module-links",
			id: courseModuleLinkId,
			depth: 2, // Need to get activity module and quiz
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

		const isLate = quiz?.dueDate ? new Date() > new Date(quiz.dueDate) : false;

		const startedAt = new Date().toISOString();

		const submission = await payload.create({
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
			user,
			req,
			overrideAccess,
		});

		// Schedule auto-submit job if quiz has a time limit
		if (quiz) {
			const rawConfig = quiz.rawQuizConfig as unknown as QuizConfig | null;
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

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseModuleLinkRef = submission.courseModuleLink;
		assertZodInternal(
			"tryStartQuizAttempt: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZodInternal(
			"tryStartQuizAttempt: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZodInternal(
			"tryStartQuizAttempt: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			courseModuleLink: courseModuleLinkRef.id,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to start quiz attempt", {
			cause: error,
		}),
);

/**
 * Creates a new quiz submission
 */
export const tryCreateQuizSubmission = Result.wrap(
	async (args: CreateQuizSubmissionArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			answers,
			timeSpent,
			user = null,
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
		if (!answers || answers.length === 0) {
			throw new InvalidArgumentError(
				"Quiz submission must have at least one answer",
			);
		}

		// Check if submission already exists for this attempt
		const existingSubmission = await payload.find({
			collection: "quiz-submissions",
			where: {
				and: [
					{ courseModuleLink: { equals: courseModuleLinkId } },
					{ student: { equals: studentId } },
					{ attemptNumber: { equals: attemptNumber } },
				],
			},
			user,
			req,
			overrideAccess,
		});

		if (existingSubmission.docs.length > 0) {
			throw new InvalidArgumentError(
				`Submission already exists for attempt ${attemptNumber}`,
			);
		}

		// Get course module link to access quiz
		const courseModuleLink = await payload.findByID({
			collection: "course-activity-module-links",
			id: courseModuleLinkId,
			depth: 2, // Need to get activity module and quiz
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

		const isLate = quiz?.dueDate ? new Date() > new Date(quiz.dueDate) : false;

		const submission = await payload.create({
			collection: "quiz-submissions",
			data: {
				courseModuleLink: courseModuleLinkId,
				student: studentId,
				enrollment: enrollmentId,
				attemptNumber,
				status: "in_progress",
				answers,
				isLate,
				timeSpent,
			},
			user,
			req,
			overrideAccess,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseModuleLinkRef = submission.courseModuleLink;
		assertZodInternal(
			"tryCreateQuizSubmission: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZodInternal(
			"tryCreateQuizSubmission: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZodInternal(
			"tryCreateQuizSubmission: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			courseModuleLink: courseModuleLinkRef.id,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create quiz submission", {
			cause: error,
		}),
);

/**
 * Updates a quiz submission
 */
export const tryUpdateQuizSubmission = Result.wrap(
	async (args: UpdateQuizSubmissionArgs) => {
		const {
			payload,
			id,
			status,
			answers,
			timeSpent,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Build update data object
		const updateData: Record<string, unknown> = {};
		if (status !== undefined) updateData.status = status;
		if (answers !== undefined) updateData.answers = answers;
		if (timeSpent !== undefined) updateData.timeSpent = timeSpent;

		// If status is being changed to completed, set submittedAt
		if (status === "completed") {
			updateData.submittedAt = new Date().toISOString();
		}

		// Validate that at least one field is being updated
		if (Object.keys(updateData).length === 0) {
			throw new InvalidArgumentError(
				"At least one field must be provided for update",
			);
		}

		const updatedSubmission = await payload.update({
			collection: "quiz-submissions",
			id,
			data: updateData,
			user,
			req,
			overrideAccess,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseModuleLinkRef = updatedSubmission.courseModuleLink;
		assertZodInternal(
			"tryUpdateQuizSubmission: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZodInternal(
			"tryUpdateQuizSubmission: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZodInternal(
			"tryUpdateQuizSubmission: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			courseModuleLink: courseModuleLinkRef.id,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update quiz submission", {
			cause: error,
		}),
);

/**
 * Gets a quiz submission by ID
 */
export const tryGetQuizSubmissionById = Result.wrap(
	async (args: GetQuizSubmissionByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Fetch the quiz submission
		const submissionResult = await payload.find({
			collection: "quiz-submissions",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth: 1, // Fetch related data
			user,
			req,
			overrideAccess,
		});

		const submission = submissionResult.docs[0];

		if (!submission) {
			throw new NonExistingQuizSubmissionError(
				`Quiz submission with id '${id}' not found`,
			);
		}

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseModuleLinkRef = submission.courseModuleLink;
		assertZodInternal(
			"tryGetQuizSubmissionById: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZodInternal(
			"tryGetQuizSubmissionById: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZodInternal(
			"tryGetQuizSubmissionById: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			courseModuleLink: courseModuleLinkRef.id,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get quiz submission", {
			cause: error,
		}),
);

/**
 * Submits a quiz (marks as completed)
 */
export const trySubmitQuiz = Result.wrap(
	async (args: SubmitQuizArgs) => {
		const {
			payload,
			submissionId,
			user = null,
			req,
			overrideAccess = false,
			bypassTimeLimit = false,
		} = args;

		// Validate ID
		if (!submissionId) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Get the current submission
		const currentSubmission = await payload.findByID({
			collection: "quiz-submissions",
			id: submissionId,
			user,
			req,
			overrideAccess,
		});

		if (!currentSubmission) {
			throw new NonExistingQuizSubmissionError(
				`Quiz submission with id '${submissionId}' not found`,
			);
		}

		if (currentSubmission.status !== "in_progress") {
			throw new InvalidArgumentError(
				"Only in-progress submissions can be submitted",
			);
		}

		// Check time limit if quiz has one (unless bypassed for auto-submit)
		if (currentSubmission.startedAt && !bypassTimeLimit) {
			// Get course module link to access quiz time limit
			const courseModuleLink = await payload.findByID({
				collection: "course-activity-module-links",
				id:
					typeof currentSubmission.courseModuleLink === "object" &&
						"id" in currentSubmission.courseModuleLink
						? currentSubmission.courseModuleLink.id
						: (currentSubmission.courseModuleLink as number),
				depth: 2,
				user,
				req,
				overrideAccess,
			});

			if (courseModuleLink) {
				const activityModule =
					typeof courseModuleLink.activityModule === "object"
						? courseModuleLink.activityModule
						: null;
				const quiz =
					activityModule && typeof activityModule.quiz === "object"
						? activityModule.quiz
						: null;

				// Get globalTimer from rawQuizConfig (in seconds) and convert to minutes
				const rawConfig = quiz?.rawQuizConfig as unknown as QuizConfig | null;
				const timeLimitMinutes = rawConfig?.globalTimer
					? rawConfig.globalTimer / 60
					: null;

				if (timeLimitMinutes) {
					const startedAt = new Date(currentSubmission.startedAt);
					const now = new Date();
					const timeElapsedMinutes =
						(now.getTime() - startedAt.getTime()) / (1000 * 60);

					if (timeElapsedMinutes > timeLimitMinutes) {
						throw new QuizTimeLimitExceededError(
							`Quiz time limit of ${timeLimitMinutes} minutes has been exceeded. Time elapsed: ${Math.ceil(timeElapsedMinutes)} minutes.`,
						);
					}
				}
			}
		}

		// Build update data
		const updateData: Record<string, unknown> = {
			status: "completed",
			submittedAt: new Date().toISOString(),
		};

		// Add answers if provided
		if (args.answers !== undefined) {
			updateData.answers = args.answers;
		}

		// Add timeSpent if provided
		if (args.timeSpent !== undefined) {
			updateData.timeSpent = args.timeSpent;
		}

		// Update status to completed
		const updatedSubmission = await payload.update({
			collection: "quiz-submissions",
			id: submissionId,
			data: updateData,
			user,
			req,
			overrideAccess,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const courseModuleLinkRef = updatedSubmission.courseModuleLink;
		assertZodInternal(
			"trySubmitQuiz: Course module link is required",
			courseModuleLinkRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZodInternal(
			"trySubmitQuiz: Student is required",
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZodInternal(
			"trySubmitQuiz: Enrollment is required",
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			courseModuleLink: courseModuleLinkRef.id,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to submit quiz", {
			cause: error,
		}),
);

/**
 * Calculates quiz grade based on answers and correct answers
 */
export const calculateQuizGrade = Result.wrap(
	async (
		payload: Payload,
		quizId: number,
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
		}>,
	): Promise<QuizGradingResult> => {
		// Get the quiz to access correct answers
		const quiz = await payload.findByID({
			collection: "quizzes",
			id: quizId,
		});

		if (!quiz) {
			throw new InvalidArgumentError("Quiz not found");
		}

		let totalScore = 0;
		let maxScore = 0;
		const questionResults: Array<{
			questionId: string;
			questionText: string;
			questionType: string;
			pointsEarned: number;
			maxPoints: number;
			isCorrect: boolean;
			feedback: string;
			correctAnswer?: string | null;
			explanation?: string | null;
		}> = [];

		// Process each question
		for (const question of quiz.questions || []) {
			const maxPoints = question.points;
			maxScore += maxPoints;

			// Find the corresponding answer
			const answer = answers.find(
				(a) => a.questionId === question.id?.toString(),
			);

			if (!answer) {
				// No answer provided
				questionResults.push({
					questionId: question.id?.toString() || "",
					questionText: question.questionText,
					questionType: question.questionType,
					pointsEarned: 0,
					maxPoints,
					isCorrect: false,
					feedback: "No answer provided",
					correctAnswer: question.correctAnswer,
					explanation: question.explanation,
				});
				continue;
			}

			let pointsEarned = 0;
			let isCorrect = false;
			let feedback = "";

			// Grade based on question type
			switch (question.questionType) {
				case "multiple_choice": {
					const correctOptions =
						question.options?.filter((opt) => opt.isCorrect) || [];
					const selectedOptions =
						answer.multipleChoiceAnswers?.filter((opt) => opt.isSelected) || [];

					// Check if all correct options are selected and no incorrect options are selected
					const correctSelected = correctOptions.every((correct) =>
						selectedOptions.some(
							(selected) => selected.option === correct.text,
						),
					);
					const noIncorrectSelected = selectedOptions.every((selected) =>
						correctOptions.some((correct) => correct.text === selected.option),
					);

					if (
						correctSelected &&
						noIncorrectSelected &&
						selectedOptions.length === correctOptions.length
					) {
						pointsEarned = maxPoints;
						isCorrect = true;
						feedback = "Correct!";
					} else {
						feedback =
							"Incorrect. The correct answer(s) were: " +
							correctOptions.map((opt) => opt.text).join(", ");
					}
					break;
				}

				case "true_false": {
					const correctAnswer = question.correctAnswer?.toLowerCase();
					const selectedAnswer = answer.selectedAnswer?.toLowerCase();

					if (correctAnswer === selectedAnswer) {
						pointsEarned = maxPoints;
						isCorrect = true;
						feedback = "Correct!";
					} else {
						feedback = `Incorrect. The correct answer is: ${question.correctAnswer}`;
					}
					break;
				}

				case "short_answer": {
					const correctAnswer = question.correctAnswer?.toLowerCase().trim();
					const selectedAnswer = answer.selectedAnswer?.toLowerCase().trim();

					if (correctAnswer === selectedAnswer) {
						pointsEarned = maxPoints;
						isCorrect = true;
						feedback = "Correct!";
					} else {
						feedback = `Incorrect. The correct answer is: ${question.correctAnswer}`;
					}
					break;
				}

				case "essay": {
					// Essays are typically graded manually, but we can provide partial credit based on length
					const answerLength = answer.selectedAnswer?.length || 0;
					if (answerLength > 100) {
						pointsEarned = Math.floor(maxPoints * 0.5); // 50% for having content
						feedback = "Essay submitted. Manual grading required.";
					} else {
						feedback =
							"Essay too short. Please provide a more detailed response.";
					}
					break;
				}

				case "fill_blank": {
					const correctAnswer = question.correctAnswer?.toLowerCase().trim();
					const selectedAnswer = answer.selectedAnswer?.toLowerCase().trim();

					if (correctAnswer === selectedAnswer) {
						pointsEarned = maxPoints;
						isCorrect = true;
						feedback = "Correct!";
					} else {
						feedback = `Incorrect. The correct answer is: ${question.correctAnswer}`;
					}
					break;
				}

				default:
					feedback = "Question type not supported for automatic grading";
			}

			// Add explanation if available
			if (question.explanation && !isCorrect) {
				feedback += ` Explanation: ${question.explanation}`;
			}

			totalScore += pointsEarned;

			questionResults.push({
				questionId: question.id?.toString() || "",
				questionText: question.questionText,
				questionType: question.questionType,
				pointsEarned,
				maxPoints,
				isCorrect,
				feedback,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
			});
		}

		// round to 2 decimal places
		const percentage =
			maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;

		// Generate overall feedback
		const correctCount = questionResults.filter((q) => q.isCorrect).length;
		const totalQuestions = questionResults.length;

		// generate report
		const overallFeedback = `Quiz completed! You scored ${totalScore}/${maxScore} points (${percentage}%). You got ${correctCount}/${totalQuestions} questions correct.`;

		return {
			totalScore,
			maxScore,
			percentage,
			questionResults,
			feedback: overallFeedback,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate quiz grade", {
			cause: error,
		}),
);

/**
 * Grades a quiz submission automatically and creates gradebook entry
 */
export const tryGradeQuizSubmission = Result.wrap(
	async (payload: Payload, request: Request, args: GradeQuizSubmissionArgs) => {
		const { id, enrollmentId, gradebookItemId, gradedBy, submittedAt } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Validate required gradebook fields
		if (!enrollmentId) {
			throw new InvalidArgumentError(
				"Enrollment ID is required for gradebook integration",
			);
		}
		if (!gradebookItemId) {
			throw new InvalidArgumentError(
				"Gradebook item ID is required for gradebook integration",
			);
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get the current submission
			const currentSubmission = await payload.findByID({
				collection: QuizSubmissions.slug,
				id,
				req: { transactionID },
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
			const courseModuleLink = await payload.findByID({
				collection: "course-activity-module-links",
				id:
					typeof currentSubmission.courseModuleLink === "object" &&
						"id" in currentSubmission.courseModuleLink
						? currentSubmission.courseModuleLink.id
						: (currentSubmission.courseModuleLink as number),
				depth: 2,
				req: { transactionID },
			});

			if (!courseModuleLink) {
				throw new InvalidArgumentError("Course module link not found");
			}

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

			// Calculate the grade
			const validAnswers = (currentSubmission.answers ?? [])
				.filter(
					(answer) =>
						answer.questionText && typeof answer.questionText === "string",
				)
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

			const gradingResult = await calculateQuizGrade(
				payload,
				quiz.id,
				validAnswers,
			);

			if (!gradingResult.ok) {
				throw new Error(
					`Failed to calculate quiz grade: ${gradingResult.error}`,
				);
			}

			const gradeData = gradingResult.value;

			// Update submission with grade
			const updatedSubmission = await payload.update({
				collection: QuizSubmissions.slug,
				id,
				data: {
					status: "graded",
					totalScore: gradeData.totalScore,
					maxScore: gradeData.maxScore,
					percentage: gradeData.percentage,
					autoGraded: true,
				},
				req: { transactionID },
			});

			// Create user grade in gradebook
			const submittedAtString =
				submittedAt !== undefined
					? String(submittedAt)
					: updatedSubmission.submittedAt !== undefined
						? String(updatedSubmission.submittedAt)
						: undefined;
			const userGradeResult = await tryCreateUserGrade({
				payload,
				user: null,
				req: { ...request, transactionID },
				overrideAccess: false,
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

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;
			assertZodInternal(
				"tryGradeQuizSubmission: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZodInternal(
				"tryGradeQuizSubmission: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZodInternal(
				"tryGradeQuizSubmission: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef.id,
				student,
				enrollment,
				grade: gradeData.totalScore,
				maxGrade: gradeData.maxScore,
				percentage: gradeData.percentage,
				feedback: gradeData.feedback,
				gradedBy,
				userGrade: userGradeResult.value,
				questionResults: gradeData.questionResults,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to grade quiz submission", {
			cause: error,
		}),
);

/**
 * Lists quiz submissions with filtering
 */
export const tryListQuizSubmissions = Result.wrap(
	async (args: ListQuizSubmissionsArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			enrollmentId,
			status,
			limit = 10,
			page = 1,
			user = null,
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

		const result = await payload.find({
			collection: "quiz-submissions",
			where,
			limit,
			page,
			sort: "-createdAt",
			depth: 1, // Fetch related data
			user,
			req,
			overrideAccess,
		});

		// type narrowing
		const docs = result.docs.map((doc) => {
			assertZodInternal(
				"tryListQuizSubmissions: Course module link is required",
				doc.courseModuleLink,
				z.object({
					id: z.number(),
				}),
			);
			assertZodInternal(
				"tryListQuizSubmissions: Student is required",
				doc.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZodInternal(
				"tryListQuizSubmissions: Enrollment is required",
				doc.enrollment,
				z.object({
					id: z.number(),
				}),
			);
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

/**
 * Checks if there's an in_progress submission for a student and quiz
 */
export const tryCheckInProgressSubmission = Result.wrap(
	async (args: CheckInProgressSubmissionArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			user = null,
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
			user,
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

/**
 * Gets the next attempt number for a student and quiz
 */
export const tryGetNextAttemptNumber = Result.wrap(
	async (args: GetNextAttemptNumberArgs) => {
		const {
			payload,
			courseModuleLinkId,
			studentId,
			user = null,
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
			limit: 100, // Get all submissions to find max attempt number
			user,
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

/**
 * Deletes a quiz submission
 */
export const tryDeleteQuizSubmission = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Check if submission exists
		const existingSubmission = await payload.findByID({
			collection: "quiz-submissions",
			id,
		});

		if (!existingSubmission) {
			throw new NonExistingQuizSubmissionError(
				`Quiz submission with id '${id}' not found`,
			);
		}

		const deletedSubmission = await payload.delete({
			collection: "quiz-submissions",
			id,
		});

		return deletedSubmission;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete quiz submission", {
			cause: error,
		}),
);

/**
 * Gets quiz grades report for a course module
 */
export const tryGetQuizGradesReport = Result.wrap(
	async (args: GetQuizGradesReportArgs) => {
		const {
			payload,
			courseModuleLinkId,
			user = null,
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
			user,
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
			user,
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
		const questions = quiz.questions || [];
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

		// Calculate max score from quiz points or sum of question points
		const maxScore =
			quiz.points ?? questions.reduce((sum, q) => sum + q.points, 0);

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

/**
 * Gets quiz statistics report for a course module
 */
export const tryGetQuizStatisticsReport = Result.wrap(
	async (args: GetQuizStatisticsReportArgs) => {
		const {
			payload,
			courseModuleLinkId,
			user = null,
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
			user,
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
			user,
			req,
			overrideAccess,
		});

		if (!submissionsResult.ok) {
			throw submissionsResult.error;
		}

		const submissions = submissionsResult.value.docs;
		const questions = quiz.questions || [];

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
						const currentCount = responseCounts.get(answer.selectedAnswer) || 0;
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
				questionText: question.questionText,
				questionType: question.questionType,
				maxPoints: question.points,
				totalAttempts,
				answeredCount,
				correctCount,
				incorrectCount,
				averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimals
				difficulty,
				responseDistribution,
			});
		}

		// Calculate max score from quiz points or sum of question points
		const maxScore =
			quiz.points ?? questions.reduce((sum, q) => sum + q.points, 0);

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
