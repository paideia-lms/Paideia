import { describe, expect, test } from "bun:test";
import { Users } from "../collections/users";

const roleField = Users.fields.find((f) => f.name === "role");
const roleUpdateAccess =
	roleField && typeof roleField === "object" && "access" in roleField
		? (roleField.access as { update?: (args: {
				req: { user?: { id: number; role: string }; data?: { role?: string } };
				doc: Record<string, unknown>;
		  }) => boolean }).update
		: undefined;

function createReq(
	user: { id: number; role: string } | null,
	data?: { role?: string },
) {
	return {
		req: {
			user: user ?? undefined,
			data,
		},
	};
}

describe("Users collection - role field access.update", () => {
	test("role field access.update is defined", () => {
		expect(roleUpdateAccess).toBeDefined();
	});

	test("denies when req.user is missing", () => {
		const result = roleUpdateAccess!({
			...createReq(null),
			doc: { id: 1, role: "admin" },
		});
		expect(result).toBe(false);
	});

	test("denies when doc is null", () => {
		if (!roleUpdateAccess) throw new Error("Role field access.update not found");
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }),
			doc: null as unknown as Record<string, unknown>,
		});
		expect(result).toBe(false);
	});

	test("denies when doc is not an object", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }),
			doc: "invalid" as unknown as Record<string, unknown>,
		});
		expect(result).toBe(false);
	});

	test("denies when doc has no valid id", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }),
			doc: { role: "admin" },
		});
		expect(result).toBe(false);
	});

	test("denies first user (id 1) from changing their admin role to student", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }, { role: "student" }),
			doc: { id: 1, role: "admin" },
		});
		expect(result).toBe(false);
	});

	test("denies first user from changing their admin role to instructor", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }, { role: "instructor" }),
			doc: { id: 1, role: "admin" },
		});
		expect(result).toBe(false);
	});

	test("allows first user to keep admin role (no role change in data)", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }),
			doc: { id: 1, role: "admin" },
		});
		expect(result).toBe(true);
	});

	test("allows first user when explicitly setting role to admin", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }, { role: "admin" }),
			doc: { id: 1, role: "admin" },
		});
		expect(result).toBe(true);
	});

	test("denies admin from changing another admin user's role", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }, { role: "student" }),
			doc: { id: 2, role: "admin" },
		});
		expect(result).toBe(false);
	});

	test("allows admin to update non-admin user's role", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 1, role: "admin" }, { role: "instructor" }),
			doc: { id: 2, role: "student" },
		});
		expect(result).toBe(true);
	});

	test("allows user to update their own role", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 5, role: "student" }, { role: "instructor" }),
			doc: { id: 5, role: "student" },
		});
		expect(result).toBe(true);
	});

	test("denies non-admin from updating another user's role", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 5, role: "student" }, { role: "admin" }),
			doc: { id: 2, role: "student" },
		});
		expect(result).toBe(false);
	});

	test("allows admin to update their own role (non-first user)", () => {
		const result = roleUpdateAccess!({
			...createReq({ id: 2, role: "admin" }, { role: "content-manager" }),
			doc: { id: 2, role: "admin" },
		});
		expect(result).toBe(true);
	});
});
