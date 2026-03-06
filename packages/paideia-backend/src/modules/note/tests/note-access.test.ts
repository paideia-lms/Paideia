import { describe, expect, test } from "bun:test";
import type { AccessArgs } from "payload";
import { Notes } from "../collections/notes";

const readAccess = Notes.access?.read;
const createAccess = Notes.access?.create;
const updateAccess = Notes.access?.update;
const deleteAccess = Notes.access?.delete;

function createAccessArgs(user: { id: number; role: string } | null): AccessArgs {
	return {
		req: {
			user: user ?? undefined,
		},
	} as AccessArgs;
}

describe("Notes collection - access permissions", () => {
	describe("read access", () => {
		test("read access is defined", () => {
			expect(readAccess).toBeDefined();
		});

		test("denies when req.user is missing", () => {
			const result = readAccess!(createAccessArgs(null));
			expect(result).toBe(false);
		});

		test("allows admin to read all notes", () => {
			const result = readAccess!(createAccessArgs({ id: 1, role: "admin" }));
			expect(result).toBe(true);
		});

		test("returns query for non-admin user (own notes or public)", () => {
			const result = readAccess!(createAccessArgs({ id: 5, role: "student" }));
			expect(result).not.toBe(false);
			expect(result).not.toBe(true);
			expect(typeof result).toBe("object");
			if (
				typeof result === "object" &&
				result !== null &&
				"or" in result &&
				result.or
			) {
				expect(Array.isArray(result.or)).toBe(true);
				expect(result.or).toHaveLength(2);
				expect(result.or[0]).toEqual({
					createdBy: { equals: 5 },
				});
				expect(result.or[1]).toEqual({
					isPublic: { equals: true },
				});
			}
		});
	});

	describe("create access", () => {
		test("create access is defined", () => {
			expect(createAccess).toBeDefined();
		});

		test("denies when req.user is missing", () => {
			const result = createAccess!(createAccessArgs(null));
			expect(result).toBe(false);
		});

		test("allows admin to create notes", () => {
			const result = createAccess!(createAccessArgs({ id: 1, role: "admin" }));
			expect(result).toBe(true);
		});

		test("allows student to create notes", () => {
			const result = createAccess!(createAccessArgs({ id: 5, role: "student" }));
			expect(result).toBe(true);
		});

		test("allows instructor to create notes", () => {
			const result = createAccess!(createAccessArgs({ id: 3, role: "instructor" }));
			expect(result).toBe(true);
		});
	});

	describe("update access", () => {
		test("update access is defined", () => {
			expect(updateAccess).toBeDefined();
		});

		test("denies when req.user is missing", () => {
			const result = updateAccess!(createAccessArgs(null));
			expect(result).toBe(false);
		});

		test("allows admin to update all notes", () => {
			const result = updateAccess!(createAccessArgs({ id: 1, role: "admin" }));
			expect(result).toBe(true);
		});

		test("returns query for non-admin user (own notes only)", () => {
			const result = updateAccess!(createAccessArgs({ id: 5, role: "student" }));
			expect(result).not.toBe(false);
			expect(result).not.toBe(true);
			expect(typeof result).toBe("object");
			if (typeof result === "object" && result !== null && "createdBy" in result) {
				expect(result.createdBy).toEqual({ equals: 5 });
			}
		});
	});

	describe("delete access", () => {
		test("delete access is defined", () => {
			expect(deleteAccess).toBeDefined();
		});

		test("denies when req.user is missing", () => {
			const result = deleteAccess!(createAccessArgs(null));
			expect(result).toBe(false);
		});

		test("allows admin to delete all notes", () => {
			const result = deleteAccess!(createAccessArgs({ id: 1, role: "admin" }));
			expect(result).toBe(true);
		});

		test("returns query for non-admin user (own notes only)", () => {
			const result = deleteAccess!(createAccessArgs({ id: 5, role: "student" }));
			expect(result).not.toBe(false);
			expect(result).not.toBe(true);
			expect(typeof result).toBe("object");
			if (typeof result === "object" && result !== null && "createdBy" in result) {
				expect(result.createdBy).toEqual({ equals: 5 });
			}
		});
	});
});
