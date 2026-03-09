import { describe, expect, test } from "bun:test";
import { Assignments } from "../collections/assignments";
import { AssignmentSubmissions } from "../collections/assignment-submissions";

const assignmentsAccess = Assignments.access;
const submissionsAccess = AssignmentSubmissions.access;

function createReq(user: { id: number; role: string } | null) {
	return {
		req: {
			user: user ?? undefined,
		},
	} as unknown as Parameters<typeof assignmentsAccess.read>[0];
}

function createReqWithDoc(
	user: { id: number; role: string } | null,
	doc: Record<string, unknown>,
) {
	return {
		req: {
			user: user ?? undefined,
		},
		doc,
	} as unknown as Parameters<typeof assignmentsAccess.update>[0];
}

describe("Assignments collection - access.read", () => {
	test("denies when req.user is missing", () => {
		const result = assignmentsAccess.read(createReq(null));
		expect(result).toBe(false);
	});

	test("allows any authenticated user", () => {
		const result = assignmentsAccess.read(createReq({ id: 1, role: "student" }));
		expect(result).toBe(true);
	});

	test("allows admin", () => {
		const result = assignmentsAccess.read(createReq({ id: 1, role: "admin" }));
		expect(result).toBe(true);
	});

	test("allows instructor", () => {
		const result = assignmentsAccess.read(createReq({ id: 2, role: "instructor" }));
		expect(result).toBe(true);
	});

	test("allows student", () => {
		const result = assignmentsAccess.read(createReq({ id: 3, role: "student" }));
		expect(result).toBe(true);
	});
});

describe("Assignments collection - access.create", () => {
	test("denies when req.user is missing", () => {
		const result = assignmentsAccess.create(createReq(null));
		expect(result).toBe(false);
	});

	test("allows admin", () => {
		const result = assignmentsAccess.create(createReq({ id: 1, role: "admin" }));
		expect(result).toBe(true);
	});

	test("allows instructor", () => {
		const result = assignmentsAccess.create(createReq({ id: 2, role: "instructor" }));
		expect(result).toBe(true);
	});

	test("allows content-manager", () => {
		const result = assignmentsAccess.create(createReq({ id: 3, role: "content-manager" }));
		expect(result).toBe(true);
	});

	test("denies student", () => {
		const result = assignmentsAccess.create(createReq({ id: 4, role: "student" }));
		expect(result).toBe(false);
	});
});

describe("Assignments collection - access.update", () => {
	test("denies when req.user is missing", () => {
		const result = assignmentsAccess.update(createReqWithDoc(null, { id: 1, createdBy: 1 }));
		expect(result).toBe(false);
	});

	test("allows admin to update any assignment", () => {
		const result = assignmentsAccess.update(
			createReqWithDoc({ id: 1, role: "admin" }, { id: 5, createdBy: 10 }),
		);
		expect(result).toBe(true);
	});

	test("allows creator to update their own assignment", () => {
		const result = assignmentsAccess.update(
			createReqWithDoc({ id: 5, role: "instructor" }, { id: 5, createdBy: 5 }),
		);
		expect(result).toEqual({ createdBy: { equals: 5 } });
	});

	test("denies non-creator from updating assignment", () => {
		const result = assignmentsAccess.update(
			createReqWithDoc({ id: 5, role: "instructor" }, { id: 10, createdBy: 3 }),
		);
		expect(result).toEqual({ createdBy: { equals: 5 } });
	});

	test("denies student from updating any assignment", () => {
		const result = assignmentsAccess.update(
			createReqWithDoc({ id: 4, role: "student" }, { id: 5, createdBy: 4 }),
		);
		expect(result).toEqual({ createdBy: { equals: 4 } });
	});
});

describe("Assignments collection - access.delete", () => {
	test("denies when req.user is missing", () => {
		const result = assignmentsAccess.delete(createReqWithDoc(null, { id: 1, createdBy: 1 }));
		expect(result).toBe(false);
	});

	test("allows admin to delete any assignment", () => {
		const result = assignmentsAccess.delete(
			createReqWithDoc({ id: 1, role: "admin" }, { id: 5, createdBy: 10 }),
		);
		expect(result).toBe(true);
	});

	test("allows creator to delete their own assignment", () => {
		const result = assignmentsAccess.delete(
			createReqWithDoc({ id: 5, role: "instructor" }, { id: 5, createdBy: 5 }),
		);
		expect(result).toEqual({ createdBy: { equals: 5 } });
	});

	test("denies non-creator from deleting assignment", () => {
		const result = assignmentsAccess.delete(
			createReqWithDoc({ id: 5, role: "instructor" }, { id: 10, createdBy: 3 }),
		);
		expect(result).toEqual({ createdBy: { equals: 5 } });
	});
});

describe("AssignmentSubmissions collection - access.read", () => {
	test("denies when req.user is missing", () => {
		const result = submissionsAccess.read(createReq(null));
		expect(result).toBe(false);
	});

	test("allows admin to read all submissions", () => {
		const result = submissionsAccess.read(createReq({ id: 1, role: "admin" }));
		expect(result).toBe(true);
	});

	test("allows instructor to read all submissions", () => {
		const result = submissionsAccess.read(createReq({ id: 2, role: "instructor" }));
		expect(result).toBe(true);
	});

	test("denies student from reading all submissions (should filter by own student)", () => {
		const result = submissionsAccess.read(createReq({ id: 3, role: "student" }));
		expect(result).toEqual({ student: { equals: 3 } });
	});
});

describe("AssignmentSubmissions collection - access.create", () => {
	test("denies when req.user is missing", () => {
		const result = submissionsAccess.create(createReq(null));
		expect(result).toBe(false);
	});

	test("allows admin to create submissions", () => {
		const result = submissionsAccess.create(createReq({ id: 1, role: "admin" }));
		expect(result).toBe(true);
	});

	test("allows instructor to create submissions", () => {
		const result = submissionsAccess.create(createReq({ id: 2, role: "instructor" }));
		expect(result).toBe(true);
	});

	test("allows student to create submissions", () => {
		const result = submissionsAccess.create(createReq({ id: 3, role: "student" }));
		expect(result).toBe(true);
	});
});

describe("AssignmentSubmissions collection - access.update", () => {
	test("denies when req.user is missing", () => {
		const result = submissionsAccess.update(
			createReqWithDoc(null, { id: 1, student: 3 }),
		);
		expect(result).toBe(false);
	});

	test("allows admin to update any submission", () => {
		const result = submissionsAccess.update(
			createReqWithDoc({ id: 1, role: "admin" }, { id: 5, student: 10 }),
		);
		expect(result).toBe(true);
	});

	test("allows instructor to update any submission", () => {
		const result = submissionsAccess.update(
			createReqWithDoc({ id: 2, role: "instructor" }, { id: 5, student: 10 }),
		);
		expect(result).toBe(true);
	});

	test("allows student to update their own submission", () => {
		const result = submissionsAccess.update(
			createReqWithDoc({ id: 5, role: "student" }, { id: 5, student: 5 }),
		);
		expect(result).toEqual({ student: { equals: 5 } });
	});

	test("denies student from updating another student's submission", () => {
		const result = submissionsAccess.update(
			createReqWithDoc({ id: 5, role: "student" }, { id: 10, student: 3 }),
		);
		expect(result).toEqual({ student: { equals: 5 } });
	});
});

describe("AssignmentSubmissions collection - access.delete", () => {
	test("denies when req.user is missing", () => {
		const result = submissionsAccess.delete(createReqWithDoc(null, { id: 1, student: 3 }));
		expect(result).toBe(false);
	});

	test("allows admin to delete any submission", () => {
		const result = submissionsAccess.delete(
			createReqWithDoc({ id: 1, role: "admin" }, { id: 5, student: 10 }),
		);
		expect(result).toBe(true);
	});

	test("denies instructor from deleting submissions", () => {
		const result = submissionsAccess.delete(
			createReqWithDoc({ id: 2, role: "instructor" }, { id: 5, student: 10 }),
		);
		expect(result).toBe(false);
	});

	test("denies student from deleting their own submission", () => {
		const result = submissionsAccess.delete(
			createReqWithDoc({ id: 5, role: "student" }, { id: 5, student: 5 }),
		);
		expect(result).toBe(false);
	});

	test("denies student from deleting another student's submission", () => {
		const result = submissionsAccess.delete(
			createReqWithDoc({ id: 5, role: "student" }, { id: 10, student: 3 }),
		);
		expect(result).toBe(false);
	});
});
