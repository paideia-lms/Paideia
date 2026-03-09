import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, type Migration } from "payload";
import sanitizedConfig from "payload.config";
import {
	tryCreateAssignment,
	tryUpdateAssignment,
	tryFindAssignmentById,
	tryListAssignmentsByCourse,
	tryDeleteAssignment,
	trySubmitAssignment,
	tryGradeSubmission,
	tryListSubmissions,
	tryFindSubmissionById,
	tryDeleteSubmission,
} from "../services/assignment-management";
import { UserModule } from "@paideia/module-user";
import { CourseModule } from "@paideia/module-course";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	assignmentTestUserSeedData,
	assignmentTestCourseSeedData,
	assignmentTestSectionSeedData,
} from "../seeding/assignment-test-seed-data";
import { migrations } from "src/migrations";

describe("Assignment Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);

	let adminUser: { id: number };
	let instructorUser: { id: number };
	let student1User: { id: number };
	let student2User: { id: number };
	let testCourseId: number;
	let testSection1Id: number;
	let testSection2Id: number;
	let createdAssignmentId: number;
	let createdSubmissionId: number;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: assignmentTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		adminUser = usersResult.byEmail.get("admin@example.com")!.user;
		instructorUser = usersResult.byEmail.get("instructor@example.com")!.user;
		student1User = usersResult.byEmail.get("student1@example.com")!.user;
		student2User = usersResult.byEmail.get("student2@example.com")!.user;

		const coursesResult = (
			await courseModule.seedCourses({
				data: assignmentTestCourseSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const testCourse = coursesResult.courses.find(c => c.slug === "test-course")!;
		testCourseId = testCourse.id;

		const sectionsResult = (
			await courseModule.seedCourseSections({
				data: assignmentTestSectionSeedData,
				coursesBySlug: new Map(coursesResult.courses.map(c => [c.slug, c])),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		testSection1Id = sectionsResult.sections.find(s => s.title === "Test Section 1")!.id;
		testSection2Id = sectionsResult.sections.find(s => s.title === "Test Section 2")!.id;
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateAssignment", () => {
		test("should create an assignment successfully", async () => {
			const result = await tryCreateAssignment({
				payload,
				data: {
					title: "Test Assignment",
					description: "A test assignment",
					instructions: "Complete the following tasks.",
					courseId: testCourseId,
					sectionId: testSection1Id,
					maxAttempts: 2,
					maxGrade: 100,
					requireTextSubmission: true,
					createdBy: instructorUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.title).toBe("Test Assignment");
				expect(result.value.maxAttempts).toBe(2);
				expect(result.value.maxGrade).toBe(100);
				createdAssignmentId = result.value.id;
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryCreateAssignment({
				payload,
				data: {
					title: "",
					courseId: testCourseId,
					sectionId: testSection1Id,
					createdBy: instructorUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should create assignment in different section", async () => {
			const result = await tryCreateAssignment({
				payload,
				data: {
					title: "Section 2 Assignment",
					courseId: testCourseId,
					sectionId: testSection2Id,
					createdBy: instructorUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
		});
	});

	describe("tryUpdateAssignment", () => {
		test("should update assignment successfully", async () => {
			const result = await tryUpdateAssignment({
				payload,
				assignmentId: createdAssignmentId,
				data: {
					title: "Updated Assignment Title",
					maxAttempts: 3,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.title).toBe("Updated Assignment Title");
				expect(result.value.maxAttempts).toBe(3);
			}
		});
	});

	describe("tryFindAssignmentById", () => {
		test("should find assignment by id", async () => {
			const result = await tryFindAssignmentById({
				payload,
				assignmentId: createdAssignmentId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(createdAssignmentId);
				expect(result.value.title).toBe("Updated Assignment Title");
			}
		});
	});

	describe("tryListAssignmentsByCourse", () => {
		test("should list assignments for a course", async () => {
			const result = await tryListAssignmentsByCourse({
				payload,
				courseId: testCourseId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalDocs).toBeGreaterThanOrEqual(2);
			}
		});

		test("should filter by section", async () => {
			const result = await tryListAssignmentsByCourse({
				payload,
				courseId: testCourseId,
				sectionId: testSection1Id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalDocs).toBe(1);
			}
		});
	});

	describe("trySubmitAssignment", () => {
		test("should submit assignment successfully", async () => {
			const result = await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student1User.id,
				content: "My submission content",
				attemptNumber: 1,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.status).toBe("submitted");
				expect(result.value.content).toBe("My submission content");
				createdSubmissionId = result.value.id;
			}
		});

		test("should fail when exceeding max attempts", async () => {
			await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student2User.id,
				content: "Attempt 1",
				attemptNumber: 1,
				overrideAccess: true,
				req: undefined,
			});

			await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student2User.id,
				content: "Attempt 2",
				attemptNumber: 2,
				overrideAccess: true,
				req: undefined,
			});

			await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student2User.id,
				content: "Attempt 3",
				attemptNumber: 3,
				overrideAccess: true,
				req: undefined,
			});

			const result = await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student2User.id,
				content: "Attempt 4 should fail",
				attemptNumber: 4,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryGradeSubmission", () => {
		test("should grade submission successfully", async () => {
			const result = await tryGradeSubmission({
				payload,
				submissionId: createdSubmissionId,
				grade: 85,
				feedback: "Good work!",
				gradedBy: instructorUser.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.grade).toBe(85);
				expect(result.value.status).toBe("graded");
				expect(result.value.feedback).toBe("Good work!");
			}
		});

		test("should fail grading already graded submission", async () => {
			const result = await tryGradeSubmission({
				payload,
				submissionId: createdSubmissionId,
				grade: 90,
				gradedBy: instructorUser.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with negative grade", async () => {
			const freshSubmission = await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student1User.id,
				content: "Another submission",
				attemptNumber: 2,
				overrideAccess: true,
				req: undefined,
			});

			expect(freshSubmission.ok).toBe(true);
			if (!freshSubmission.ok) return;

			const result = await tryGradeSubmission({
				payload,
				submissionId: freshSubmission.value.id,
				grade: -5,
				gradedBy: instructorUser.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryListSubmissions", () => {
		test("should list all submissions", async () => {
			const result = await tryListSubmissions({
				payload,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalDocs).toBeGreaterThanOrEqual(1);
			}
		});

		test("should filter by assignment", async () => {
			const result = await tryListSubmissions({
				payload,
				assignmentId: createdAssignmentId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalDocs).toBeGreaterThanOrEqual(1);
			}
		});

		test("should filter by student", async () => {
			const result = await tryListSubmissions({
				payload,
				studentId: student1User.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalDocs).toBeGreaterThanOrEqual(1);
			}
		});
	});

	describe("tryFindSubmissionById", () => {
		test("should find submission by id", async () => {
			const result = await tryFindSubmissionById({
				payload,
				submissionId: createdSubmissionId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(createdSubmissionId);
			}
		});
	});

	describe("tryDeleteAssignment", () => {
		test("should delete assignment successfully", async () => {
			const tempResult = await tryCreateAssignment({
				payload,
				data: {
					title: "To Be Deleted",
					courseId: testCourseId,
					sectionId: testSection1Id,
					createdBy: instructorUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(tempResult.ok).toBe(true);
			if (!tempResult.ok) return;

			const deleteResult = await tryDeleteAssignment({
				payload,
				assignmentId: tempResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(deleteResult.ok).toBe(true);
		});
	});

	describe("tryDeleteSubmission", () => {
		test("should delete submission successfully", async () => {
			const subResult = await trySubmitAssignment({
				payload,
				assignmentId: createdAssignmentId,
				studentId: student1User.id,
				content: "To be deleted",
				attemptNumber: 3,
				overrideAccess: true,
				req: undefined,
			});

			expect(subResult.ok).toBe(true);
			if (!subResult.ok) return;

			const deleteResult = await tryDeleteSubmission({
				payload,
				submissionId: subResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(deleteResult.ok).toBe(true);
		});
	});
});
