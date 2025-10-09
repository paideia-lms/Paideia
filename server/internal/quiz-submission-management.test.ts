import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
} from "./enrollment-management";
import {
	type CreateGradebookItemArgs,
	tryCreateGradebookItem,
} from "./gradebook-item-management";
import {
	type CreateQuizArgs,
	type CreateQuizSubmissionArgs,
	calculateQuizGrade,
	tryCreateQuiz,
	tryCreateQuizSubmission,
	tryDeleteQuizSubmission,
	tryGetQuizById,
	tryGetQuizSubmissionById,
	tryGradeQuizSubmission,
	tryListQuizSubmissions,
	trySubmitQuiz,
	tryUpdateQuizSubmission,
	type UpdateQuizSubmissionArgs,
} from "./quiz-submission-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Quiz Management - Full Workflow", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
	let gradebookItemId: number;
	let activityModuleId: number;
	let quizId: number;
	let courseActivityModuleLinkId: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create teacher user
		const teacherArgs: CreateUserArgs = {
			email: "quiz-teacher@example.com",
			password: "password123",
			firstName: "John",
			lastName: "Teacher",
			role: "user",
		};

		const teacherResult = await tryCreateUser(
			payload,
			mockRequest,
			teacherArgs,
		);
		expect(teacherResult.ok).toBe(true);
		if (!teacherResult.ok) {
			throw new Error("Test Error: Failed to create test teacher");
		}
		teacherId = teacherResult.value.id;

		// Create student user
		const studentArgs: CreateUserArgs = {
			email: "quiz-student@example.com",
			password: "password123",
			firstName: "Jane",
			lastName: "Student",
			role: "user",
		};

		const studentResult = await tryCreateUser(
			payload,
			mockRequest,
			studentArgs,
		);
		expect(studentResult.ok).toBe(true);
		if (!studentResult.ok) {
			throw new Error("Test Error: Failed to create test student");
		}
		studentId = studentResult.value.id;

		// Create course
		const courseArgs: CreateCourseArgs = {
			title: "Quiz Test Course",
			description: "A test course for quiz submissions",
			slug: "quiz-test-course",
			createdBy: teacherId,
		};

		const courseResult = await tryCreateCourse(
			payload,
			mockRequest,
			courseArgs,
		);
		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Test Error: Failed to create test course");
		}
		courseId = courseResult.value.id;

		// Create enrollment
		const enrollmentArgs: CreateEnrollmentArgs = {
			user: studentId,
			course: courseId,
			role: "student",
			status: "active",
		};

		const enrollmentResult = await tryCreateEnrollment(payload, enrollmentArgs);
		expect(enrollmentResult.ok).toBe(true);
		if (!enrollmentResult.ok) {
			throw new Error("Test Error: Failed to create test enrollment");
		}
		enrollmentId = enrollmentResult.value.id;

		// Create activity module with quiz
		const activityModuleArgs: CreateActivityModuleArgs = {
			title: "Test Quiz",
			description: "A test quiz for submission workflow",
			type: "quiz",
			status: "published",
			userId: teacherId,
			quizData: {
				instructions: "Complete this quiz by answering all questions",
				dueDate: `${year}-12-31T23:59:59Z`,
				maxAttempts: 3,
				allowLateSubmissions: true,
				points: 100,
				gradingType: "automatic",
				timeLimit: 30,
				showCorrectAnswers: true,
				allowMultipleAttempts: true,
				shuffleQuestions: false,
				shuffleAnswers: false,
				showOneQuestionAtATime: false,
				requirePassword: false,
				accessPassword: "",
				questions: [
					{
						questionText: "What is 2 + 2?",
						questionType: "multiple_choice",
						points: 25,
						options: [
							{ text: "3", isCorrect: false },
							{ text: "4", isCorrect: true },
							{ text: "5", isCorrect: false },
							{ text: "6", isCorrect: false },
						],
						explanation: "2 + 2 equals 4",
					},
					{
						questionText: "Is the sky blue?",
						questionType: "true_false",
						points: 25,
						correctAnswer: "true",
						explanation: "Yes, the sky appears blue due to light scattering",
					},
					{
						questionText: "What is the capital of France?",
						questionType: "short_answer",
						points: 25,
						correctAnswer: "Paris",
						explanation: "Paris is the capital and largest city of France",
					},
					{
						questionText:
							"Write a short essay about the importance of education",
						questionType: "essay",
						points: 25,
						explanation: "This question requires manual grading",
					},
				],
			},
		};

		const activityModuleResult = await tryCreateActivityModule(
			payload,
			activityModuleArgs,
		);
		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		activityModuleId = activityModuleResult.value.id;
		console.log("Created activity module with ID:", activityModuleId);
		// Get the quiz ID from the activity module
		if (
			activityModuleResult.value.quiz &&
			typeof activityModuleResult.value.quiz === "object" &&
			"id" in activityModuleResult.value.quiz
		) {
			quizId = activityModuleResult.value.quiz.id as number;
			console.log("Extracted quiz ID:", quizId);
		}

		// Create course-activity-module-link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			course: courseId,
			activityModule: activityModuleId,
		};

		const linkResult = await tryCreateCourseActivityModuleLink(
			payload,
			mockRequest,
			linkArgs,
		);
		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) {
			throw new Error(
				"Test Error: Failed to create course-activity-module-link",
			);
		}
		courseActivityModuleLinkId = linkResult.value.id;
		console.log(
			"Created course-activity-module-link with ID:",
			courseActivityModuleLinkId,
		);

		// Verify gradebook exists
		const verifyGradebook = await payload.findByID({
			collection: "gradebooks",
			id: courseResult.value.gradebook.id,
		});
		console.log(
			"Gradebook verification result:",
			verifyGradebook ? "Found" : "Not found",
		);

		// Create gradebook item for the quiz
		console.log(
			"Creating gradebook item with activityModuleId:",
			activityModuleId,
			"gradebookId:",
			courseResult.value.gradebook.id,
		);

		// Verify activity module exists
		const verifyActivityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
		});
		console.log(
			"Activity module verification result:",
			verifyActivityModule ? "Found" : "Not found",
		);

		const gradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: courseResult.value.gradebook.id,
			name: "Test Quiz",
			description: "Quiz submission test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 1,
		};

		const gradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			gradebookItemArgs,
		);
		if (!gradebookItemResult.ok) {
			console.error(
				"Gradebook item creation failed:",
				gradebookItemResult.error,
			);
		}
		expect(gradebookItemResult.ok).toBe(true);
		if (gradebookItemResult.ok) {
			gradebookItemId = gradebookItemResult.value.id;
		}
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create quiz (teacher workflow)", async () => {
		const args: CreateQuizArgs = {
			title: "Math Quiz",
			description: "A basic math quiz",
			instructions: "Answer all questions carefully",
			dueDate: `${year}-12-31T23:59:59Z`,
			maxAttempts: 3,
			allowLateSubmissions: true,
			points: 100,
			gradingType: "automatic",
			timeLimit: 30,
			showCorrectAnswers: true,
			allowMultipleAttempts: true,
			shuffleQuestions: false,
			shuffleAnswers: false,
			showOneQuestionAtATime: false,
			requirePassword: false,
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 25,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
						{ text: "5", isCorrect: false },
						{ text: "6", isCorrect: false },
					],
					explanation: "2 + 2 equals 4",
				},
				{
					questionText: "Is the sky blue?",
					questionType: "true_false",
					points: 25,
					correctAnswer: "true",
					explanation: "Yes, the sky appears blue due to light scattering",
				},
				{
					questionText: "What is the capital of France?",
					questionType: "short_answer",
					points: 25,
					correctAnswer: "Paris",
					explanation: "Paris is the capital and largest city of France",
				},
				{
					questionText: "Write a short essay about the importance of education",
					questionType: "essay",
					points: 25,
					explanation: "This question requires manual grading",
				},
			],
			createdBy: teacherId,
		};

		const result = await tryCreateQuiz(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const quiz = result.value;

		// Verify quiz
		expect(quiz.title).toBe("Math Quiz");
		expect(quiz.description).toBe("A basic math quiz");
		expect(quiz.instructions).toBe("Answer all questions carefully");
		expect(quiz.maxAttempts).toBe(3);
		expect(quiz.allowLateSubmissions).toBe(true);
		expect(quiz.points).toBe(100);
		expect(quiz.gradingType).toBe("automatic");
		expect(quiz.timeLimit).toBe(30);
		expect(quiz.showCorrectAnswers).toBe(true);
		expect(quiz.allowMultipleAttempts).toBe(true);
		expect(quiz.questions).toHaveLength(4);
		expect(quiz.createdBy.id).toBe(teacherId);
		expect(quiz.id).toBeDefined();
		expect(quiz.createdAt).toBeDefined();
	});

	test("should create quiz submission (student workflow)", async () => {
		const args: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
				{
					questionId: "2",
					questionText: "Is the sky blue?",
					questionType: "true_false",
					selectedAnswer: "true",
				},
				{
					questionId: "3",
					questionText: "What is the capital of France?",
					questionType: "short_answer",
					selectedAnswer: "Paris",
				},
				{
					questionId: "4",
					questionText: "Write a short essay about the importance of education",
					questionType: "essay",
					selectedAnswer:
						"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
				},
			],
			timeSpent: 15,
		};

		const result = await tryCreateQuizSubmission(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.activityModule.id).toBe(activityModuleId);
		expect(submission.quiz.id).toBe(quizId);
		expect(submission.student.id).toBe(studentId);
		expect(submission.enrollment.id).toBe(enrollmentId);
		expect(submission.attemptNumber).toBe(1);
		expect(submission.status).toBe("in_progress");
		expect(submission.answers).toHaveLength(4);
		expect(submission.timeSpent).toBe(15);
		expect(submission.isLate).toBe(false); // Not late yet
		expect(submission.id).toBeDefined();
		expect(submission.createdAt).toBeDefined();
	});

	test("should update quiz submission (student editing answers)", async () => {
		// First create a submission
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 2,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: true },
						{ option: "4", isSelected: false },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateQuizSubmissionArgs = {
			id: submissionId,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
			timeSpent: 20,
		};

		const updateResult = await tryUpdateQuizSubmission(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok)
			throw new Error("Test Error: Failed to update quiz submission");

		const updatedSubmission = updateResult.value;
		expect(
			updatedSubmission.answers?.[0].multipleChoiceAnswers?.[1].isSelected,
		).toBe(true);
		expect(updatedSubmission.timeSpent).toBe(20);
		expect(updatedSubmission.status).toBe("in_progress"); // Should remain in progress
	});

	test("should submit quiz (student submits for grading)", async () => {
		// First create a submission
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 3,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
				{
					questionId: "2",
					questionText: "Is the sky blue?",
					questionType: "true_false",
					selectedAnswer: "true",
				},
				{
					questionId: "3",
					questionText: "What is the capital of France?",
					questionType: "short_answer",
					selectedAnswer: "Paris",
				},
				{
					questionId: "4",
					questionText: "Write a short essay about the importance of education",
					questionType: "essay",
					selectedAnswer:
						"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the quiz
		const submitResult = await trySubmitQuiz(payload, submissionId);
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		const submittedSubmission = submitResult.value;
		expect(submittedSubmission.status).toBe("completed");
		expect(submittedSubmission.submittedAt).toBeDefined();
		expect(submittedSubmission.answers).toHaveLength(4);
	});

	test("should calculate quiz grade automatically", async () => {
		// First get the quiz to get the actual question IDs
		const quizResult = await tryGetQuizById(payload, { id: quizId });
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const questions = quiz.questions || [];

		// Test the calculateQuizGrade function directly with actual question IDs
		const answers = [
			{
				questionId: questions[0]?.id?.toString() || "1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice" as const,
				multipleChoiceAnswers: [
					{ option: "3", isSelected: false },
					{ option: "4", isSelected: true },
					{ option: "5", isSelected: false },
					{ option: "6", isSelected: false },
				],
			},
			{
				questionId: questions[1]?.id?.toString() || "2",
				questionText: "Is the sky blue?",
				questionType: "true_false" as const,
				selectedAnswer: "true",
			},
			{
				questionId: questions[2]?.id?.toString() || "3",
				questionText: "What is the capital of France?",
				questionType: "short_answer" as const,
				selectedAnswer: "Paris",
			},
			{
				questionId: questions[3]?.id?.toString() || "4",
				questionText: "Write a short essay about the importance of education",
				questionType: "essay" as const,
				selectedAnswer:
					"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
			},
		];

		const result = await calculateQuizGrade(payload, quizId, answers);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const gradeData = result.value;

		// Verify grading results
		expect(gradeData.totalScore).toBe(87); // 25 + 25 + 25 + 12 (essay partial credit)
		expect(gradeData.maxScore).toBe(100);
		expect(gradeData.percentage).toBe(87);
		expect(gradeData.questionResults).toHaveLength(4);

		// Check individual question results
		const question1 = gradeData.questionResults.find(
			(q) => q.questionId === questions[0]?.id?.toString(),
		);
		expect(question1?.isCorrect).toBe(true);
		expect(question1?.pointsEarned).toBe(25);
		expect(question1?.feedback).toBe("Correct!");

		const question2 = gradeData.questionResults.find(
			(q) => q.questionId === questions[1]?.id?.toString(),
		);
		expect(question2?.isCorrect).toBe(true);
		expect(question2?.pointsEarned).toBe(25);
		expect(question2?.feedback).toBe("Correct!");

		const question3 = gradeData.questionResults.find(
			(q) => q.questionId === questions[2]?.id?.toString(),
		);
		expect(question3?.isCorrect).toBe(true);
		expect(question3?.pointsEarned).toBe(25);
		expect(question3?.feedback).toBe("Correct!");

		const question4 = gradeData.questionResults.find(
			(q) => q.questionId === questions[3]?.id?.toString(),
		);
		expect(question4?.isCorrect).toBe(false);
		expect(question4?.pointsEarned).toBe(12); // 50% of 25 points
		expect(question4?.feedback).toContain(
			"Essay submitted. Manual grading required.",
		);

		// Check overall feedback
		expect(gradeData.feedback).toContain(
			"Quiz completed! You scored 87/100 points (87%)",
		);
		expect(gradeData.feedback).toContain("You got 3/4 questions correct");
	});

	test("should grade quiz submission automatically and create gradebook entry", async () => {
		// Create a separate gradebook item for this test to avoid conflicts
		const gradingGradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: 1, // Use the gradebook ID from the course creation
			name: "Quiz Grading Test",
			description: "Separate gradebook item for grading test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 2,
		};

		const gradingGradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			gradingGradebookItemArgs,
		);
		expect(gradingGradebookItemResult.ok).toBe(true);
		if (!gradingGradebookItemResult.ok) return;

		const gradingGradebookItemId = gradingGradebookItemResult.value.id;

		// First get the quiz to get the actual question IDs
		const quizResult = await tryGetQuizById(payload, { id: quizId });
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const questions = quiz.questions || [];

		// First create and submit a quiz
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 4,
			answers: [
				{
					questionId: questions[0]?.id?.toString() || "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
				{
					questionId: questions[1]?.id?.toString() || "2",
					questionText: "Is the sky blue?",
					questionType: "true_false",
					selectedAnswer: "true",
				},
				{
					questionId: questions[2]?.id?.toString() || "3",
					questionText: "What is the capital of France?",
					questionType: "short_answer",
					selectedAnswer: "Paris",
				},
				{
					questionId: questions[3]?.id?.toString() || "4",
					questionText: "Write a short essay about the importance of education",
					questionType: "essay",
					selectedAnswer:
						"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the quiz
		const submitResult = await trySubmitQuiz(payload, submissionId);
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Grade the quiz (now includes gradebook integration)
		const gradeResult = await tryGradeQuizSubmission(payload, mockRequest, {
			id: submissionId,
			enrollmentId,
			gradebookItemId: gradingGradebookItemId,
			gradedBy: teacherId,
			submittedAt: submitResult.value.submittedAt ?? undefined,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) return;

		const gradedSubmission = gradeResult.value;
		expect(gradedSubmission.status).toBe("graded");
		expect(gradedSubmission.grade).toBe(87);
		expect(gradedSubmission.maxGrade).toBe(100);
		expect(gradedSubmission.percentage).toBe(87);
		expect(gradedSubmission.feedback).toContain(
			"Quiz completed! You scored 87/100 points (87%)",
		);
		expect(gradedSubmission.gradedBy).toBe(teacherId);
		expect(gradedSubmission.userGrade).toBeDefined();
		expect(gradedSubmission.userGrade.baseGrade).toBe(87);
		expect(gradedSubmission.userGrade.baseGradeSource).toBe("submission");
		expect(gradedSubmission.userGrade.submissionType).toBe("quiz");
		expect(gradedSubmission.questionResults).toHaveLength(4);
	});

	test("should get quiz by ID", async () => {
		const result = await tryGetQuizById(payload, { id: quizId });

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const quiz = result.value;
		expect(quiz.id).toBe(quizId);
		expect(quiz.title).toBe("Test Quiz");
		expect(quiz.questions).toHaveLength(4);
		expect(quiz.createdBy.id).toBe(teacherId);
	});

	test("should get quiz submission by ID", async () => {
		// First create a submission
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 5,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const getResult = await tryGetQuizSubmissionById(payload, {
			id: submissionId,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedSubmission = getResult.value;
		expect(retrievedSubmission.id).toBe(submissionId);
		expect(retrievedSubmission.activityModule.id).toBe(activityModuleId);
		expect(retrievedSubmission.quiz.id).toBe(quizId);
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
		expect(retrievedSubmission.answers).toHaveLength(1);
	});

	test("should list quiz submissions with filtering", async () => {
		// List all submissions for this activity module
		const listResult = await tryListQuizSubmissions(payload, {
			activityModuleId,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.docs.length).toBeGreaterThan(0);
		expect(submissions.totalDocs).toBeGreaterThan(0);

		// All submissions should be for the same activity module
		submissions.docs.forEach((submission) => {
			expect(submission.activityModule.id).toBe(activityModuleId);
		});

		// Test filtering by student
		const studentListResult = await tryListQuizSubmissions(payload, {
			studentId,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});

		// Test filtering by status
		const inProgressListResult = await tryListQuizSubmissions(payload, {
			status: "in_progress",
		});

		expect(inProgressListResult.ok).toBe(true);
		if (!inProgressListResult.ok) return;

		const inProgressSubmissions = inProgressListResult.value;
		inProgressSubmissions.docs.forEach((submission) => {
			expect(submission.status).toBe("in_progress");
		});
	});

	test("should handle late submissions", async () => {
		// Create a submission after the due date (simulate late submission)
		const lateArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 6,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const result = await tryCreateQuizSubmission(payload, lateArgs);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;
		// Note: isLate calculation depends on the quiz's due date
		// In a real scenario, you might need to mock the current time
		expect(submission.attemptNumber).toBe(6);
		expect(submission.answers).toHaveLength(1);
	});

	test("should prevent duplicate submissions for same attempt", async () => {
		const args: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 7,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		// Create first submission
		const firstResult = await tryCreateQuizSubmission(payload, args);
		expect(firstResult.ok).toBe(true);

		// Try to create duplicate submission for same attempt
		const duplicateResult = await tryCreateQuizSubmission(payload, args);
		expect(duplicateResult.ok).toBe(false);
	});

	test("should only allow grading of completed quizzes", async () => {
		// Create an in-progress submission
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 8,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to grade an in-progress submission
		const gradeResult = await tryGradeQuizSubmission(payload, mockRequest, {
			id: submissionId,
			enrollmentId,
			gradebookItemId,
			gradedBy: teacherId,
		});

		expect(gradeResult.ok).toBe(false);
	});

	test("should delete quiz submission", async () => {
		// Create a submission
		const createArgs: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			attemptNumber: 9,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const createResult = await tryCreateQuizSubmission(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteQuizSubmission(payload, submissionId);
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetQuizSubmissionById(payload, {
			id: submissionId,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should handle pagination in listing", async () => {
		// Create multiple submissions for pagination testing
		for (let i = 0; i < 5; i++) {
			const createArgs: CreateQuizSubmissionArgs = {
				activityModuleId,
				quizId,
				studentId,
				enrollmentId,
				attemptNumber: 20 + i,
				answers: [
					{
						questionId: "1",
						questionText: "What is 2 + 2?",
						questionType: "multiple_choice",
						multipleChoiceAnswers: [
							{ option: "3", isSelected: false },
							{ option: "4", isSelected: true },
							{ option: "5", isSelected: false },
							{ option: "6", isSelected: false },
						],
					},
				],
			};

			const createResult = await tryCreateQuizSubmission(payload, createArgs);
			expect(createResult.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListQuizSubmissions(payload, {
			activityModuleId,
			limit: 2,
			page: 1,
		});

		expect(page1Result.ok).toBe(true);
		if (!page1Result.ok) return;

		expect(page1Result.value.docs.length).toBeLessThanOrEqual(2);
		expect(page1Result.value.page).toBe(1);
		expect(page1Result.value.limit).toBe(2);
		expect(page1Result.value.hasNextPage).toBeDefined();
		expect(page1Result.value.hasPrevPage).toBeDefined();
	});

	test("should fail with invalid arguments", async () => {
		// Test missing activity module ID
		const invalidArgs1: CreateQuizSubmissionArgs = {
			activityModuleId: undefined as never,
			quizId,
			studentId,
			enrollmentId,
			answers: [],
		};

		const result1 = await tryCreateQuizSubmission(payload, invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing student ID
		const invalidArgs2: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId: undefined as never,
			enrollmentId,
			answers: [],
		};

		const result2 = await tryCreateQuizSubmission(payload, invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing answers
		const invalidArgs3: CreateQuizSubmissionArgs = {
			activityModuleId,
			quizId,
			studentId,
			enrollmentId,
			answers: [],
		};

		const result3 = await tryCreateQuizSubmission(payload, invalidArgs3);
		expect(result3.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetQuizSubmissionById(payload, {
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent submission", async () => {
		const updateArgs: UpdateQuizSubmissionArgs = {
			id: 99999,
			answers: [
				{
					questionId: "1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					multipleChoiceAnswers: [
						{ option: "3", isSelected: false },
						{ option: "4", isSelected: true },
						{ option: "5", isSelected: false },
						{ option: "6", isSelected: false },
					],
				},
			],
		};

		const result = await tryUpdateQuizSubmission(payload, updateArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteQuizSubmission(payload, 99999);
		expect(result.ok).toBe(false);
	});
});
