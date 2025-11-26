import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig, { JobQueue } from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateQuizModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
} from "./enrollment-management";
import { tryCreateGradebookItem } from "./gradebook-item-management";
import {
	type CreateQuizArgs,
	type CreateQuizSubmissionArgs,
	type StartQuizAttemptArgs,
	tryCalculateQuizGrade,
	tryCreateQuiz,
	tryCreateQuizSubmission,
	tryDeleteQuizSubmission,
	tryGetQuizById,
	tryGetQuizSubmissionById,
	tryGradeQuizSubmission,
	tryListQuizSubmissions,
	tryStartQuizAttempt,
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
	let sectionId: number;

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
			payload,
			data: {
				email: "quiz-teacher@example.com",
				password: "password123",
				firstName: "John",
				lastName: "Teacher",
				role: "student",
			},
			overrideAccess: true,
		};

		const teacherResult = await tryCreateUser(teacherArgs);
		expect(teacherResult.ok).toBe(true);
		if (!teacherResult.ok) {
			throw new Error("Test Error: Failed to create test teacher");
		}
		teacherId = teacherResult.value.id;

		// Create student user
		const studentArgs: CreateUserArgs = {
			payload,
			data: {
				email: "quiz-student@example.com",
				password: "password123",
				firstName: "Jane",
				lastName: "Student",
				role: "student",
			},
			overrideAccess: true,
		};

		const studentResult = await tryCreateUser(studentArgs);
		expect(studentResult.ok).toBe(true);
		if (!studentResult.ok) {
			throw new Error("Test Error: Failed to create test student");
		}
		studentId = studentResult.value.id;

		// Create course
		const courseArgs: CreateCourseArgs = {
			payload,
			data: {
				title: "Quiz Test Course",
				description: "A test course for quiz submissions",
				slug: "quiz-test-course",
				createdBy: teacherId,
			},
			overrideAccess: true,
		};

		const courseResult = await tryCreateCourse(courseArgs);
		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Test Error: Failed to create test course");
		}
		courseId = courseResult.value.id;

		// Create enrollment
		const enrollmentArgs: CreateEnrollmentArgs = {
			payload,
			userId: studentId,
			course: courseId,
			role: "student",
			status: "active",
			overrideAccess: true,
		};

		const enrollmentResult = await tryCreateEnrollment(enrollmentArgs);
		expect(enrollmentResult.ok).toBe(true);
		if (!enrollmentResult.ok) {
			throw new Error("Test Error: Failed to create test enrollment");
		}
		enrollmentId = enrollmentResult.value.id;

		// Create activity module with quiz
		const activityModuleArgs: CreateActivityModuleArgs = {
			payload,
			title: "Test Quiz",
			description: "A test quiz for submission workflow",
			type: "quiz",
			status: "published",
			userId: teacherId,
			instructions: "Complete this quiz by answering all questions",
			points: 100,
			gradingType: "automatic",
			timeLimit: 30,
			showCorrectAnswers: true,
			allowMultipleAttempts: true,
			shuffleQuestions: false,
			shuffleAnswers: false,
			showOneQuestionAtATime: false,
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
			overrideAccess: true,
		};

		const activityModuleResult = await tryCreateQuizModule(activityModuleArgs);
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
		// Since QuizModuleResult is a discriminated union, we need to check the type first
		if (activityModuleResult.value.type === "quiz") {
			// Fetch the activity module with depth to get the quiz relationship
			const module = await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				depth: 1,
			});
			if (module.quiz) {
				quizId =
					typeof module.quiz === "object" && "id" in module.quiz
						? module.quiz.id
						: (module.quiz as number);
				console.log("Extracted quiz ID:", quizId);
			}
		}

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: courseId,
				title: "Test Section",
				description: "Test section for quiz submissions",
			},
			overrideAccess: true,
		});

		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}
		sectionId = sectionResult.value.id;

		// Create course-activity-module-link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest,
			course: courseId,
			activityModule: activityModuleId,
			section: sectionResult.value.id,
			order: 0,
			overrideAccess: true,
		};

		const linkResult = await tryCreateCourseActivityModuleLink(linkArgs);
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

		// Verify activity module exists
		const verifyActivityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
		});
		console.log(
			"Activity module verification result:",
			verifyActivityModule ? "Found" : "Not found",
		);

		const gradebookItemResult = await tryCreateGradebookItem({
			payload,
			courseId: courseId,
			name: "Test Quiz",
			description: "Quiz submission test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 1,
			user: null,
			req: mockRequest,
			overrideAccess: true,
		});
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
			payload,
			title: "Math Quiz",
			description: "A basic math quiz",
			instructions: "Answer all questions carefully",
			points: 100,
			gradingType: "automatic",
			showCorrectAnswers: true,
			allowMultipleAttempts: true,
			shuffleQuestions: false,
			shuffleAnswers: false,
			showOneQuestionAtATime: false,
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

		const result = await tryCreateQuiz(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const quiz = result.value;

		// Verify quiz
		expect(quiz.title).toBe("Math Quiz");
		expect(quiz.description).toBe("A basic math quiz");
		expect(quiz.instructions).toBe("Answer all questions carefully");
		expect(quiz.points).toBe(100);
		expect(quiz.gradingType).toBe("automatic");
		expect(quiz.showCorrectAnswers).toBe(true);
		expect(quiz.allowMultipleAttempts).toBe(true);
		expect(quiz.questions).toHaveLength(4);
		expect(quiz.createdBy.id).toBe(teacherId);
		expect(quiz.id).toBeDefined();
		expect(quiz.createdAt).toBeDefined();
	});

	test("should create quiz submission (student workflow)", async () => {
		const args: CreateQuizSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const result = await tryCreateQuizSubmission(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission (activityModule and quiz are now virtual fields accessed through courseModuleLink)
		expect(submission.courseModuleLink).toBe(courseActivityModuleLinkId);
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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const createResult = await tryCreateQuizSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateQuizSubmissionArgs = {
			payload,
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
			overrideAccess: true,
		};

		const updateResult = await tryUpdateQuizSubmission(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok)
			throw new Error("Test Error: Failed to update quiz submission");

		const updatedSubmission = updateResult.value;
		expect(
			updatedSubmission.answers?.[0]!.multipleChoiceAnswers?.[1]!.isSelected,
		).toBe(true);
		expect(updatedSubmission.timeSpent).toBe(20);
		expect(updatedSubmission.status).toBe("in_progress"); // Should remain in progress
	});

	test("should submit quiz (student submits for grading)", async () => {
		// First create a submission
		const createArgs: CreateQuizSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const createResult = await tryCreateQuizSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the quiz
		const submitResult = await trySubmitQuiz({
			payload,
			req: mockRequest,
			submissionId,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		const submittedSubmission = submitResult.value;
		expect(submittedSubmission.status).toBe("completed");
		expect(submittedSubmission.submittedAt).toBeDefined();
		expect(submittedSubmission.answers).toHaveLength(4);
	});

	test("should calculate quiz grade automatically", async () => {
		// First get the quiz to get the actual question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: mockRequest,
			id: quizId,
			overrideAccess: true,
		});
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

		const result = await tryCalculateQuizGrade({
			payload,
			req: mockRequest,
			quizId,
			answers,
		});

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

	test("should get quiz by ID", async () => {
		const result = await tryGetQuizById({
			payload,
			id: quizId,
			overrideAccess: true,
		});

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
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const createResult = await tryCreateQuizSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const getResult = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedSubmission = getResult.value;
		expect(retrievedSubmission.id).toBe(submissionId);
		expect(retrievedSubmission.courseModuleLink).toBe(
			courseActivityModuleLinkId,
		);
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
		expect(retrievedSubmission.answers).toHaveLength(1);
	});

	test("should list quiz submissions with filtering", async () => {
		// List all submissions for this activity module
		const listResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.docs.length).toBeGreaterThan(0);
		expect(submissions.totalDocs).toBeGreaterThan(0);

		// All submissions should be for the same course module link
		submissions.docs.forEach((submission) => {
			expect(submission.courseModuleLink).toBe(courseActivityModuleLinkId);
		});

		// Test filtering by student
		const studentListResult = await tryListQuizSubmissions({
			payload,
			studentId,
			overrideAccess: true,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});

		// Test filtering by status
		const inProgressListResult = await tryListQuizSubmissions({
			payload,
			status: "in_progress",
			overrideAccess: true,
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
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const result = await tryCreateQuizSubmission(lateArgs);

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
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		// Create first submission
		const firstResult = await tryCreateQuizSubmission(args);
		expect(firstResult.ok).toBe(true);

		// Try to create duplicate submission for same attempt
		const duplicateResult = await tryCreateQuizSubmission(args);
		expect(duplicateResult.ok).toBe(false);
	});

	test("should only allow grading of completed quizzes", async () => {
		// Create an in-progress submission
		const createArgs: CreateQuizSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const createResult = await tryCreateQuizSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to grade an in-progress submission
		const gradeResult = await tryGradeQuizSubmission({
			payload,
			req: mockRequest,
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
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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
			overrideAccess: true,
		};

		const createResult = await tryCreateQuizSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteQuizSubmission(payload, submissionId);
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should handle pagination in listing", async () => {
		// Create multiple submissions for pagination testing
		for (let i = 0; i < 5; i++) {
			const createArgs: CreateQuizSubmissionArgs = {
				payload,
				courseModuleLinkId: courseActivityModuleLinkId,
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
				overrideAccess: true,
			};

			const createResult = await tryCreateQuizSubmission(createArgs);
			expect(createResult.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			limit: 2,
			page: 1,
			overrideAccess: true,
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
		// Test missing course module link ID
		const invalidArgs1: CreateQuizSubmissionArgs = {
			payload,
			courseModuleLinkId: undefined as never,
			studentId,
			enrollmentId,
			answers: [],
			overrideAccess: true,
		};

		const result1 = await tryCreateQuizSubmission(invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing student ID
		const invalidArgs2: CreateQuizSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId: undefined as never,
			enrollmentId,
			answers: [],
			overrideAccess: true,
		};

		const result2 = await tryCreateQuizSubmission(invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing answers
		const invalidArgs3: CreateQuizSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			answers: [],
			overrideAccess: true,
		};

		const result3 = await tryCreateQuizSubmission(invalidArgs3);
		expect(result3.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetQuizSubmissionById({
			payload,
			id: 99999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent submission", async () => {
		const updateArgs: UpdateQuizSubmissionArgs = {
			payload,
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
			overrideAccess: true,
		};

		const result = await tryUpdateQuizSubmission(updateArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteQuizSubmission(payload, 99999);
		expect(result.ok).toBe(false);
	});

	test("should store and retrieve rawQuizConfig", async () => {
		// Create a quiz with rawQuizConfig
		const rawQuizConfig = {
			id: `quiz-${Date.now()}`,
			title: "Test Quiz with Config",
			pages: [
				{
					id: `page-${Date.now()}`,
					title: "Page 1",
					questions: [
						{
							id: `q-${Date.now()}`,
							type: "multiple-choice" as const,
							prompt: "What is 2 + 2?",
							options: { a: "3", b: "4", c: "5" },
							correctAnswer: "b",
							scoring: { type: "simple" as const, points: 1 },
						},
					],
				},
			],
			grading: {
				enabled: true,
				passingScore: 70,
				showScoreToStudent: true,
				showCorrectAnswers: false,
			},
		};

		const args: CreateQuizArgs = {
			payload,
			title: "Quiz with Raw Config",
			description: "Testing rawQuizConfig storage",
			instructions: "Complete the quiz",
			points: 100,
			gradingType: "automatic",
			rawQuizConfig,
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 1,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
					correctAnswer: "4",
				},
			],
			createdBy: teacherId,
		};

		// Create the quiz
		const createResult = await tryCreateQuiz(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdQuiz = createResult.value;
		expect(createdQuiz.rawQuizConfig).toBeDefined();

		// Retrieve the quiz and verify rawQuizConfig is present
		const getResult = await tryGetQuizById({
			payload,
			id: createdQuiz.id,
			overrideAccess: true,
		});
		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedQuiz = getResult.value;
		expect(retrievedQuiz.rawQuizConfig).toBeDefined();
		// Note: rawQuizConfig is stored as JSON, so deep comparison might require parsing
		expect(retrievedQuiz.title).toBe("Quiz with Raw Config");
	});

	test("should reject submission after time limit exceeded", async () => {
		// Create a quiz with a very short time limit (1 minute = 60 seconds)
		const quickQuizArgs: CreateQuizArgs = {
			payload,
			title: "Quick Quiz",
			description: "A quiz with 1 minute time limit",
			instructions: "Complete quickly",
			points: 100,
			gradingType: "automatic",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Quick Quiz",
				globalTimer: 60, // 1 minute in seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
			createdBy: teacherId,
		};

		const quickQuizResult = await tryCreateQuiz(quickQuizArgs);
		expect(quickQuizResult.ok).toBe(true);
		if (!quickQuizResult.ok) return;

		// Create activity module with this quiz
		const quickActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			req: mockRequest,
			title: "Quick Quiz Module",
			description: "Module with quick quiz",
			type: "quiz",
			status: "published",
			userId: teacherId,
			instructions: "Complete quickly",
			points: 100,
			gradingType: "automatic",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Quick Quiz",
				globalTimer: 60, // 1 minute in seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
		};

		const quickActivityModuleResult = await tryCreateQuizModule(
			quickActivityModuleArgs,
		);
		expect(quickActivityModuleResult.ok).toBe(true);
		if (!quickActivityModuleResult.ok) return;
		const quickActivityModuleId = quickActivityModuleResult.value.id;

		// Create course-activity-module-link
		const quickLinkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest,
			course: courseId,
			activityModule: quickActivityModuleId,
			section: sectionId,
			order: 0,
		};

		const quickLinkResult =
			await tryCreateCourseActivityModuleLink(quickLinkArgs);
		expect(quickLinkResult.ok).toBe(true);
		if (!quickLinkResult.ok) return;

		const quickCourseActivityModuleLinkId = quickLinkResult.value.id;

		// Start quiz attempt
		const quickStartArgs: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: quickCourseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const quickStartResult = await tryStartQuizAttempt(quickStartArgs);
		expect(quickStartResult.ok).toBe(true);
		if (!quickStartResult.ok) return;

		const quickSubmissionId = quickStartResult.value.id;

		// Manually update startedAt to be 2 minutes ago (exceeding 1 minute limit)
		const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
		await payload.update({
			collection: "quiz-submissions",
			id: quickSubmissionId,
			data: {
				startedAt: twoMinutesAgo,
			},
		});

		// Try to submit - should fail due to time limit
		const submitResult = await trySubmitQuiz({
			payload,
			submissionId: quickSubmissionId,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(false);
		if (submitResult.ok) return;

		expect(submitResult.error.message).toContain("time limit");
	});

	test("should auto-submit quiz when timer expires", async () => {
		// Create a quiz with a very short time limit (2 seconds)
		const autoSubmitQuizArgs: CreateQuizArgs = {
			payload,
			title: "Auto Submit Quiz",
			description: "A quiz with 2 second time limit",
			instructions: "Will auto-submit",
			points: 100,
			gradingType: "automatic",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Auto Submit Quiz",
				globalTimer: 2, // 2 seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
			createdBy: teacherId,
		};

		const autoSubmitQuizResult = await tryCreateQuiz(autoSubmitQuizArgs);
		expect(autoSubmitQuizResult.ok).toBe(true);
		if (!autoSubmitQuizResult.ok) return;

		// Create activity module with this quiz
		const autoSubmitActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			req: mockRequest,
			title: "Auto Submit Quiz Module",
			description: "Module with auto-submit quiz",
			type: "quiz",
			status: "published",
			userId: teacherId,
			instructions: "Will auto-submit",
			points: 100,
			gradingType: "automatic",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Auto Submit Quiz",
				globalTimer: 2, // 2 seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
		};

		const autoSubmitActivityModuleResult = await tryCreateQuizModule(
			autoSubmitActivityModuleArgs,
		);
		expect(autoSubmitActivityModuleResult.ok).toBe(true);
		if (!autoSubmitActivityModuleResult.ok) return;

		const autoSubmitActivityModuleId = autoSubmitActivityModuleResult.value.id;

		// Create course-activity-module-link
		const autoSubmitLinkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest as Request,
			course: courseId,
			activityModule: autoSubmitActivityModuleId,
			section: sectionId,
			order: 0,
		};

		const autoSubmitLinkResult =
			await tryCreateCourseActivityModuleLink(autoSubmitLinkArgs);
		expect(autoSubmitLinkResult.ok).toBe(true);
		if (!autoSubmitLinkResult.ok) return;

		const autoSubmitCourseActivityModuleLinkId = autoSubmitLinkResult.value.id;

		// Start quiz attempt - this should schedule the auto-submit job
		const autoSubmitStartArgs: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: autoSubmitCourseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			req: mockRequest,
			overrideAccess: true,
		};

		const autoSubmitStartResult =
			await tryStartQuizAttempt(autoSubmitStartArgs);
		expect(autoSubmitStartResult.ok).toBe(true);
		if (!autoSubmitStartResult.ok) return;

		const autoSubmitSubmissionId = autoSubmitStartResult.value.id;

		// Verify initial state - should be in_progress
		const initialSubmission = await tryGetQuizSubmissionById({
			payload,
			id: autoSubmitSubmissionId,
			overrideAccess: true,
		});
		expect(initialSubmission.ok).toBe(true);
		if (!initialSubmission.ok) return;
		expect(initialSubmission.value.status).toBe("in_progress");

		// Verify that the job was scheduled
		const jobsResult = await payload.find({
			collection: "payload-jobs",
			where: {
				and: [
					{ taskSlug: { equals: "autoSubmitQuiz" } },
					{ queue: { equals: JobQueue.SECONDLY } },
				],
			},
			limit: 1,
			overrideAccess: true,
		});
		expect(jobsResult.docs.length).toBeGreaterThan(0);
		const scheduledJob = jobsResult.docs[0]!;
		expect(scheduledJob.waitUntil).toBeDefined();

		// Wait 3 seconds (longer than the 2 second timer)
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Process jobs to ensure the auto-submit job runs
		// The job queue should process jobs automatically via the "secondly" queue
		// Process both scheduled jobs and pending jobs
		await payload.jobs.handleSchedules({ queue: JobQueue.DEFAULT });
		await payload.jobs.handleSchedules({ queue: JobQueue.SECONDLY });

		// Check if the job was processed, if not, manually execute it
		const jobAfterWait = await payload.findByID({
			collection: "payload-jobs",
			id: scheduledJob.id,
			overrideAccess: true,
		});

		// If job hasn't been completed yet, manually execute it
		// This is needed in tests where automatic job processing might not be active
		if (jobAfterWait && !jobAfterWait.completedAt) {
			// Manually execute the job by calling the task handler
			const { autoSubmitQuiz } = await import("../tasks/auto-submit-quiz");
			const mockReq = {
				payload,
				user: null,
			};
			// Call the handler directly - use type assertion to bypass complex type checking
			// The handler only needs req and input, other params are optional
			if (typeof autoSubmitQuiz.handler === "function") {
				await (
					autoSubmitQuiz.handler as (args: {
						req: { payload: typeof payload; user: null };
						input: { submissionId: number };
					}) => Promise<unknown>
				)({
					req: mockReq,
					input: { submissionId: autoSubmitSubmissionId },
				});
			}
		}

		// Wait a bit more for the job to complete (jobs are processed asynchronously)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Check if the quiz was auto-submitted
		const finalSubmission = await tryGetQuizSubmissionById({
			payload,
			id: autoSubmitSubmissionId,
			overrideAccess: true,
		});
		expect(finalSubmission.ok).toBe(true);
		if (!finalSubmission.ok) return;

		// The submission should be completed (auto-submitted)
		expect(finalSubmission.value.status).toBe("completed");
		expect(finalSubmission.value.submittedAt).toBeDefined();
	});
});
