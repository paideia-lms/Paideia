import type { Payload } from "payload";
import { QuizSubmissions } from "server/collections";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingQuizSubmissionError,
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
	requirePassword?: boolean;
	accessPassword?: string;
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
	requirePassword?: boolean;
	accessPassword?: string;
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
	activityModuleId: number;
	quizId: number;
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
}

export interface UpdateQuizSubmissionArgs {
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
}

export interface GradeQuizSubmissionArgs {
	id: number;
	enrollmentId: number;
	gradebookItemId: number;
	gradedBy: number;
	submittedAt?: string | number;
}

export interface GetQuizByIdArgs {
	id: number | string;
}

export interface GetQuizSubmissionByIdArgs {
	id: number | string;
}

export interface ListQuizSubmissionsArgs {
	activityModuleId?: number;
	quizId?: number;
	studentId?: number;
	enrollmentId?: number;
	status?: "in_progress" | "completed" | "graded" | "returned";
	limit?: number;
	page?: number;
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
			timeLimit,
			showCorrectAnswers = false,
			allowMultipleAttempts = false,
			shuffleQuestions = false,
			shuffleAnswers = false,
			showOneQuestionAtATime = false,
			requirePassword = false,
			accessPassword,
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
				timeLimit,
				showCorrectAnswers,
				allowMultipleAttempts,
				shuffleQuestions,
				shuffleAnswers,
				showOneQuestionAtATime,
				requirePassword,
				accessPassword,
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
	async (payload: Payload, args: GetQuizByIdArgs) => {
		const { id } = args;

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
			timeLimit,
			showCorrectAnswers,
			allowMultipleAttempts,
			shuffleQuestions,
			shuffleAnswers,
			showOneQuestionAtATime,
			requirePassword,
			accessPassword,
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
		if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
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
		if (requirePassword !== undefined)
			updateData.requirePassword = requirePassword;
		if (accessPassword !== undefined)
			updateData.accessPassword = accessPassword;
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
 * Creates a new quiz submission
 */
export const tryCreateQuizSubmission = Result.wrap(
	async (payload: Payload, args: CreateQuizSubmissionArgs) => {
		const {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber = 1,
			answers,
			timeSpent,
		} = args;

		// Validate required fields
		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}
		if (!quizId) {
			throw new InvalidArgumentError("Quiz ID is required");
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
					{ activityModule: { equals: activityModuleId } },
					{ student: { equals: studentId } },
					{ attemptNumber: { equals: attemptNumber } },
				],
			},
		});

		if (existingSubmission.docs.length > 0) {
			throw new InvalidArgumentError(
				`Submission already exists for attempt ${attemptNumber}`,
			);
		}

		// Get quiz to check due date and calculate if late
		const quiz = await payload.findByID({
			collection: "quizzes",
			id: quizId,
		});

		if (!quiz) {
			throw new InvalidArgumentError("Quiz not found");
		}

		const isLate = quiz.dueDate ? new Date() > new Date(quiz.dueDate) : false;

		const submission = await payload.create({
			collection: "quiz-submissions",
			data: {
				activityModule: activityModuleId,
				quiz: quizId,
				student: studentId,
				enrollment: enrollmentId,
				attemptNumber,
				status: "in_progress",
				answers,
				isLate,
				timeSpent,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = submission.activityModule;
		assertZodInternal(
			"tryCreateQuizSubmission: Activity module is required",
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const quizRef = submission.quiz;
		assertZodInternal(
			"tryCreateQuizSubmission: Quiz is required",
			quizRef,
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
			activityModule,
			quiz: quizRef,
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
	async (payload: Payload, args: UpdateQuizSubmissionArgs) => {
		const { id, status, answers, timeSpent } = args;

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
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZodInternal(
			"tryUpdateQuizSubmission: Activity module is required",
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const quiz = updatedSubmission.quiz;
		assertZodInternal(
			"tryUpdateQuizSubmission: Quiz is required",
			quiz,
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
			activityModule,
			quiz,
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
	async (payload: Payload, args: GetQuizSubmissionByIdArgs) => {
		const { id } = args;

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

		const activityModule = submission.activityModule;
		assertZodInternal(
			"tryGetQuizSubmissionById: Activity module is required",
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const quiz = submission.quiz;
		assertZodInternal(
			"tryGetQuizSubmissionById: Quiz is required",
			quiz,
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
			activityModule,
			quiz,
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
	async (payload: Payload, submissionId: number) => {
		// Validate ID
		if (!submissionId) {
			throw new InvalidArgumentError("Quiz submission ID is required");
		}

		// Get the current submission
		const currentSubmission = await payload.findByID({
			collection: "quiz-submissions",
			id: submissionId,
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

		// Update status to completed
		const updatedSubmission = await payload.update({
			collection: "quiz-submissions",
			id: submissionId,
			data: {
				status: "completed",
				submittedAt: new Date().toISOString(),
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZodInternal(
			"trySubmitQuiz: Activity module is required",
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const quiz = updatedSubmission.quiz;
		assertZodInternal(
			"trySubmitQuiz: Quiz is required",
			quiz,
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
			activityModule,
			quiz,
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
				typeof currentSubmission.quiz === "object" &&
					"id" in currentSubmission.quiz
					? currentSubmission.quiz.id
					: (currentSubmission.quiz as number),
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
			const userGradeResult = await tryCreateUserGrade(payload, request, {
				enrollmentId,
				gradebookItemId,
				baseGrade: gradeData.totalScore,
				baseGradeSource: "submission",
				submission: id,
				submissionType: "quiz",
				feedback: gradeData.feedback,
				gradedBy,
				submittedAt: submittedAtString,
				transactionID,
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

			const activityModule = updatedSubmission.activityModule;
			assertZodInternal(
				"tryGradeQuizSubmission: Activity module is required",
				activityModule,
				z.object({
					id: z.number(),
				}),
			);

			const quiz = updatedSubmission.quiz;
			assertZodInternal(
				"tryGradeQuizSubmission: Quiz is required",
				quiz,
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
				activityModule,
				quiz,
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
	async (payload: Payload, args: ListQuizSubmissionsArgs = {}) => {
		const {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			status,
			limit = 10,
			page = 1,
		} = args;

		const where: Record<string, { equals: unknown }> = {};

		if (activityModuleId) {
			where.activityModule = {
				equals: activityModuleId,
			};
		}

		if (quizId) {
			where.quiz = {
				equals: quizId,
			};
		}

		if (studentId) {
			where.student = {
				equals: studentId,
			};
		}

		if (enrollmentId) {
			where.enrollment = {
				equals: enrollmentId,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		const result = await payload.find({
			collection: "quiz-submissions",
			where,
			limit,
			page,
			sort: "-createdAt",
			depth: 1, // Fetch related data
		});

		// type narrowing
		const docs = result.docs.map((doc) => {
			assertZodInternal(
				"tryListQuizSubmissions: Activity module is required",
				doc.activityModule,
				z.object({
					id: z.number(),
				}),
			);
			assertZodInternal(
				"tryListQuizSubmissions: Quiz is required",
				doc.quiz,
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
				activityModule: doc.activityModule,
				quiz: doc.quiz,
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
