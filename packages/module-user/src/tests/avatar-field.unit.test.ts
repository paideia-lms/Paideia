import { describe, expect, test } from "bun:test";
import { mediaFieldWithHook } from "../collections/hooks/avatar-field";

const avatarFieldConfig = {
	name: "avatar",
	label: "Avatar",
	type: "relationship" as const,
	relationTo: "media" as const,
	hasMany: false,
};

function getAvatarField() {
	return mediaFieldWithHook(avatarFieldConfig).fields[0];
}

/** Minimal req for unit testing field hooks. PayloadRequest has many required props; we only need payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const minimalReqForHook = { payload: {} } as any;

describe("mediaFieldWithHook", () => {
	test("should return object with fields array", () => {
		const result = mediaFieldWithHook(avatarFieldConfig);
		expect(result).toHaveProperty("fields");
		expect(Array.isArray(result.fields)).toBe(true);
		expect(result.fields).toHaveLength(1);
	});

	test("should return field with name avatar", () => {
		const field = getAvatarField();
		expect(field.name).toBe("avatar");
	});

	test("should return relationship field to media", () => {
		const field = getAvatarField();
		expect(field.type).toBe("relationship");
		expect(field.relationTo).toBe("media");
	});

	test("should have beforeChange hook", () => {
		const field = getAvatarField();
		expect(field.hooks).toBeDefined();
		expect(field.hooks?.beforeChange).toBeDefined();
		expect(Array.isArray(field.hooks?.beforeChange)).toBe(true);
		expect(field.hooks?.beforeChange?.length).toBe(1);
		expect(typeof field.hooks?.beforeChange?.[0]).toBe("function");
	});

	test("hook should return value unchanged when value is number", async () => {
		const field = getAvatarField();
		const hookFn = field.hooks?.beforeChange?.[0];
		if (!hookFn) throw new Error("Hook not found");

		const result = await hookFn({
			value: 42,
			req: minimalReqForHook,
			operation: "update",
			originalDoc: { id: 1 },
		} as Parameters<typeof hookFn>[0]);

		expect(result).toBe(42);
	});

	test("hook should return value unchanged when value is null", async () => {
		const field = getAvatarField();
		const hookFn = field.hooks?.beforeChange?.[0];
		if (!hookFn) throw new Error("Hook not found");

		const result = await hookFn({
			value: null,
			req: minimalReqForHook,
			operation: "update",
			originalDoc: { id: 1 },
		} as Parameters<typeof hookFn>[0]);

		expect(result).toBeNull();
	});

	test("hook should return value unchanged when value is undefined", async () => {
		const field = getAvatarField();
		const hookFn = field.hooks?.beforeChange?.[0];
		if (!hookFn) throw new Error("Hook not found");

		const result = await hookFn({
			value: undefined,
			req: minimalReqForHook,
			operation: "update",
			originalDoc: { id: 1 },
		} as Parameters<typeof hookFn>[0]);

		expect(result).toBeUndefined();
	});

	test("hook should return value unchanged when value is not a File-like object", async () => {
		const field = getAvatarField();
		const hookFn = field.hooks?.beforeChange?.[0];
		if (!hookFn) throw new Error("Hook not found");

		// Plain object with name/type is not a File (no arrayBuffer)
		const notAFile = { name: "test.png", type: "image/png" };

		const result = await hookFn({
			value: notAFile,
			req: minimalReqForHook,
			operation: "create",
			originalDoc: undefined,
		} as Parameters<typeof hookFn>[0]);

		expect(result).toBe(notAFile);
	});

	test("should preserve baseField overrides", () => {
		const field = mediaFieldWithHook({
			...avatarFieldConfig,
			label: "Profile Picture",
		}).fields[0];
		expect(field.label).toBe("Profile Picture");
	});
});
