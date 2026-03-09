import { describe, expect, test } from "bun:test";
import { Courses } from "../collections/courses";
import { CourseSections } from "../collections/course-sections";

function createReq(user: { id: number; role: string } | null) {
	return {
		req: {
			user: user ?? undefined,
		},
	};
}

describe("Courses collection - access control", () => {
	describe("create access", () => {
		test("denies when user is not logged in", () => {
			const result = Courses.access.create(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = Courses.access.create(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("denies instructor role", () => {
			const result = Courses.access.create(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows admin role", () => {
			const result = Courses.access.create(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows content-manager role", () => {
			const result = Courses.access.create(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});

	describe("read access", () => {
		test("allows anyone to read", () => {
			const result = Courses.access.read();
			expect(result).toBe(true);
		});
	});

	describe("update access", () => {
		test("denies when user is not logged in", () => {
			const result = Courses.access.update(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = Courses.access.update(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("denies instructor role", () => {
			const result = Courses.access.update(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("denies content-manager role", () => {
			const result = Courses.access.update(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows admin role", () => {
			const result = Courses.access.update(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});

	describe("delete access", () => {
		test("denies when user is not logged in", () => {
			const result = Courses.access.delete(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = Courses.access.delete(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("denies instructor role", () => {
			const result = Courses.access.delete(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("denies content-manager role", () => {
			const result = Courses.access.delete(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows admin role", () => {
			const result = Courses.access.delete(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});
});

describe("CourseSections collection - access control", () => {
	describe("create access", () => {
		test("denies when user is not logged in", () => {
			const result = CourseSections.access.create(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = CourseSections.access.create(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows instructor role", () => {
			const result = CourseSections.access.create(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows admin role", () => {
			const result = CourseSections.access.create(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows content-manager role", () => {
			const result = CourseSections.access.create(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});

	describe("read access", () => {
		test("allows anyone to read", () => {
			const result = CourseSections.access.read(createReq(null) as unknown as any);
			expect(result).toBe(true);
		});
	});

	describe("update access", () => {
		test("denies when user is not logged in", () => {
			const result = CourseSections.access.update(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = CourseSections.access.update(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows instructor role", () => {
			const result = CourseSections.access.update(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows admin role", () => {
			const result = CourseSections.access.update(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows content-manager role", () => {
			const result = CourseSections.access.update(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});

	describe("delete access", () => {
		test("denies when user is not logged in", () => {
			const result = CourseSections.access.delete(createReq(null) as unknown as any);
			expect(result).toBe(false);
		});

		test("denies student role", () => {
			const result = CourseSections.access.delete(
				createReq({ id: 1, role: "student" }) as unknown as any,
			);
			expect(result).toBe(false);
		});

		test("allows instructor role", () => {
			const result = CourseSections.access.delete(
				createReq({ id: 1, role: "instructor" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows admin role", () => {
			const result = CourseSections.access.delete(
				createReq({ id: 1, role: "admin" }) as unknown as any,
			);
			expect(result).toBe(true);
		});

		test("allows content-manager role", () => {
			const result = CourseSections.access.delete(
				createReq({ id: 1, role: "content-manager" }) as unknown as any,
			);
			expect(result).toBe(true);
		});
	});
});
