import { describe, expect, test } from "bun:test";
import {
	createRichTextBeforeChangeHook,
	createRichTextHookHandler,
	extractUserIdAndPayload,
	richTextContentWithHook,
} from "./rich-text-content";


describe("extractUserIdAndPayload", () => {
	test("should extract userId from req.user", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: {},
			req: { user: { id: 123 }, payload: mockPayload },
		});

		expect(result).toEqual({ userId: 123, payload: mockPayload });
	});

	test("should extract userId from data.createdBy", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: { createdBy: 456 },
			req: { payload: mockPayload },
		});

		expect(result).toEqual({ userId: 456, payload: mockPayload });
	});

	test("should extract userId from originalDoc.createdBy on update", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: {},
			req: { payload: mockPayload },
			operation: "update",
			originalDoc: { createdBy: 789 },
		});

		expect(result).toEqual({ userId: 789, payload: mockPayload });
	});

	test("should return undefined when no user context", () => {
		const result = extractUserIdAndPayload({
			data: {},
			req: {},
		});

		expect(result).toBeUndefined();
	});

	test("should return undefined when createdBy is not a number", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: { createdBy: "not-a-number" },
			req: { payload: mockPayload },
		});

		expect(result).toBeUndefined();
	});

	test("should return undefined for create operation without user", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: {},
			req: { payload: mockPayload },
			operation: "create",
			originalDoc: { createdBy: 123 },
		});

		expect(result).toBeUndefined();
	});

	test("should prefer req.user over data.createdBy", () => {
		const mockPayload = {} as any;
		const result = extractUserIdAndPayload({
			data: { createdBy: 456 },
			req: { user: { id: 123 }, payload: mockPayload },
		});

		expect(result).toEqual({ userId: 123, payload: mockPayload });
	});
});

describe("createRichTextHookHandler", () => {
	test("should return data unchanged when data is undefined", async () => {
		const result = await createRichTextHookHandler({
			data: undefined,
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBeUndefined();
	});

	test("should return data unchanged when no user context", async () => {
		const data = { content: "test content" };
		const result = await createRichTextHookHandler({
			data,
			req: {},
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBe(data);
	});

	test("should return data unchanged when no fields to process", async () => {
		const mockPayload = {} as any;
		const data = { title: "test title" };
		const result = await createRichTextHookHandler({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBe(data);
	});

	test("should return data unchanged when field value is not a string", async () => {
		const mockPayload = {} as any;
		const data = { content: 12345 };
		const result = await createRichTextHookHandler({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBe(data);
	});

	test("should return data unchanged when field value is empty string", async () => {
		const mockPayload = {} as any;
		const data = { content: "" };
		const result = await createRichTextHookHandler({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBeDefined();
		expect(result.content).toBe("");
	});

	test("should return data unchanged when field value is only whitespace", async () => {
		const mockPayload = {} as any;
		const data = { content: "   " };
		const result = await createRichTextHookHandler({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(result).toBeDefined();
		expect(result.content).toBe("   ");
	});
});

describe("createRichTextBeforeChangeHook", () => {
	test("should return a function", () => {
		const hook = createRichTextBeforeChangeHook({
			fields: [{ key: "content", alt: "Test alt" }],
		});

		expect(typeof hook).toBe("function");
	});

	test("returned hook should be async", () => {
		const hook = createRichTextBeforeChangeHook({
			fields: [{ key: "content", alt: "Test alt" }],
		});

		const result = hook({ data: {} });
		expect(result).toBeInstanceOf(Promise);
	});

	test("should process multiple fields", async () => {
		const mockPayload = {
			find: () => Promise.resolve({ docs: [] }),
		} as any;

		const hook = createRichTextBeforeChangeHook({
			fields: [
				{ key: "description", alt: "Description alt" },
				{ key: "summary", alt: "Summary alt" },
			],
		});

		const data = {
			description: "<p>Test</p>",
			summary: "<p>Summary</p>",
		};

		const result = await hook({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
		});

		expect(result).toBeDefined();
		expect(result).not.toBe(data);
	});
});

describe("richTextContentWithHook", () => {
	test("should return object with fields array", () => {
		const result = richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Content",
			},
			"Content image",
		);

		expect(result).toHaveProperty("fields");
		expect(Array.isArray(result.fields)).toBe(true);
	});

	test("should return 2 fields - textarea and media relationship", () => {
		const result = richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Content",
			},
			"Content image",
		);

		expect(result.fields).toHaveLength(2);
	});

	test("first field should be textarea with hooks", () => {
		const result = richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Content",
			},
			"Content image",
		);

		const field = result.fields[0] as any;
		expect(field.name).toBe("content");
		expect(field.type).toBe("textarea");
		expect(field.hooks).toBeDefined();
		expect(field.hooks.beforeChange).toBeDefined();
		expect(Array.isArray(field.hooks.beforeChange)).toBe(true);
		expect(field.hooks.beforeChange.length).toBe(1);
		expect(typeof field.hooks.beforeChange[0]).toBe("function");
	});

	test("second field should be media relationship", () => {
		const result = richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Content",
			},
			"Content image",
		);

		const mediaField = result.fields[1] as any;
		expect(mediaField.name).toBe("contentMedia");
		expect(mediaField.type).toBe("relationship");
		expect(mediaField.relationTo).toBe("media");
		expect(mediaField.hasMany).toBe(true);
	});

	test("should preserve additional field config", () => {
		const result = richTextContentWithHook(
			{
				name: "content",
				type: "textarea",
				label: "Content",
				required: true,
				maxLength: 5000,
			},
			"Content image",
		);

		const field = result.fields[0] as any;
		expect(field.required).toBe(true);
		expect(field.maxLength).toBe(5000);
	});

	test("hook should use correct field name and alt", async () => {
		const mockPayload = {
			find: () => Promise.resolve({ docs: [] }),
		} as any;

		const result = richTextContentWithHook(
			{
				name: "description",
				type: "textarea",
				label: "Description",
			},
			"Custom alt text",
		);

		const field = result.fields[0] as any;
		const hookFn = field.hooks.beforeChange[0];

		const data = { description: "<p>Test content</p>" };
		const siblingData = {};

		await hookFn({
			data,
			req: { user: { id: 123 }, payload: mockPayload },
			siblingData,
			value: "<p>Test content</p>",
			operation: "create",
		});

		expect(siblingData).toHaveProperty("descriptionMedia");
	});
});
