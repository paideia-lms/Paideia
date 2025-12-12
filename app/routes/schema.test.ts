import { describe, expect, test } from "bun:test";
import {
	inputSchema,
	descriptionImagePreviewSchema,
	descriptionImageSchema,
	type InputSchema,
} from "./schema";

describe("course.$id.settings inputSchema", () => {
	test("descriptionImageSchema", () => {
		const schema = descriptionImageSchema;
		const data = {
			"description-image-1": new File([], "image.png"),
		};
		const result = schema.safeParse(data);
		expect(result.success).toBe(true);
	});

	test("descriptionImagePreviewSchema", () => {
		const schema = descriptionImagePreviewSchema;
		const data = {
			"description-image-1-preview": "data:image/png;base64,test123",
		};
		const result = schema.safeParse(data);
		expect(result.success).toBe(true);
	});

	test("inputSchema", () => {
		const schema = inputSchema;
		const data = {
			title: "Test Course",
			slug: "test-course",
			description: "Test description",
			status: "published",
			category: 1,
			"description-image-1": new File([], "image.png"),
			"description-image-1-preview": "data:image/png;base64,test123",
		} satisfies InputSchema;
		const result = schema.safeParse(data);
		expect(result.success).toBe(true);
	});
});
