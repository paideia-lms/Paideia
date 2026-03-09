import { describe, expect, test } from "bun:test";
import { AssignmentModule } from "../index";

describe("AssignmentModule", () => {
	test("should have correct module name", () => {
		expect(AssignmentModule.moduleName).toBe("@paideia/module-assignment");
	});

	test("should export 2 collections", () => {
		expect(AssignmentModule.collections).toHaveLength(2);
		expect(AssignmentModule.collections[0]!.slug).toBe("assignments");
		expect(AssignmentModule.collections[1]!.slug).toBe("assignment-submissions");
	});

	test("should export API endpoints", () => {
		expect(AssignmentModule.api.createAssignment).toBeDefined();
		expect(AssignmentModule.api.updateAssignment).toBeDefined();
		expect(AssignmentModule.api.findAssignmentById).toBeDefined();
		expect(AssignmentModule.api.listAssignmentsByCourse).toBeDefined();
		expect(AssignmentModule.api.deleteAssignment).toBeDefined();
		expect(AssignmentModule.api.submitAssignment).toBeDefined();
		expect(AssignmentModule.api.gradeSubmission).toBeDefined();
		expect(AssignmentModule.api.listSubmissions).toBeDefined();
		expect(AssignmentModule.api.findSubmissionById).toBeDefined();
		expect(AssignmentModule.api.deleteSubmission).toBeDefined();
	});
});
