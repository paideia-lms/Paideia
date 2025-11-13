import { describe, expect, test } from "bun:test";
import { tryParseMediaFromHtml } from "./parse-media-from-html";

describe("Parse Media From HTML", () => {
	test("should parse media IDs from HTML", () => {
		const html = `<p>Test content</p><img src="/api/media/file/123" alt="Image 1" /><img src="/api/media/file/456" alt="Image 2" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(2);
			expect(result.value.ids).toContain(123);
			expect(result.value.ids).toContain(456);
			expect(result.value.filenames.length).toBe(0);
		}
	});

	test("should parse media filenames from HTML", () => {
		const html = `<p>Test content</p><img src="/api/media/file/test-image-1.png" alt="Image 1" /><img src="/api/media/file/test-image-2.png" alt="Image 2" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.filenames.length).toBe(2);
			expect(result.value.filenames).toContain("test-image-1.png");
			expect(result.value.filenames).toContain("test-image-2.png");
			expect(result.value.ids.length).toBe(0);
		}
	});

	test("should handle mixed ID and filename formats", () => {
		const html = `<p>Test content</p><img src="/api/media/file/123" alt="Image 1" /><img src="/api/media/file/test-image.png" alt="Image 2" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
			expect(result.value.filenames.length).toBe(1);
			expect(result.value.filenames).toContain("test-image.png");
		}
	});

	test("should return unique media IDs and filenames (no duplicates)", () => {
		const html = `<p>Test content</p><img src="/api/media/file/123" alt="Image 1" /><img src="/api/media/file/123" alt="Image 1 duplicate" /><img src="/api/media/file/test-image.png" alt="Image 1 filename" /><img src="/api/media/file/test-image.png" alt="Duplicate filename" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
			expect(result.value.filenames.length).toBe(1);
			expect(result.value.filenames).toContain("test-image.png");
		}
	});

	test("should return empty arrays for HTML without media references", () => {
		const html = `<p>Test content without images</p><div>Some text</div>`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(0);
			expect(result.value.filenames.length).toBe(0);
		}
	});

	test("should return empty arrays for empty HTML", () => {
		const result = tryParseMediaFromHtml("");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(0);
			expect(result.value.filenames.length).toBe(0);
		}
	});

	test("should return empty arrays for whitespace-only HTML", () => {
		const result = tryParseMediaFromHtml("   \n\t   ");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(0);
			expect(result.value.filenames.length).toBe(0);
		}
	});

	test("should ignore images without src attributes", () => {
		const html = `<p>Test content</p><img alt="No src" /><img src="/api/media/file/123" alt="With src" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
		}
	});

	test("should ignore images with non-media URLs", () => {
		const html = `<p>Test content</p><img src="https://example.com/image.png" alt="External" /><img src="/api/media/file/123" alt="Local" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
		}
	});

	test("should handle URLs with query parameters", () => {
		const html = `<p>Test content</p><img src="/api/media/file/123?download=true" alt="Image with query" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
		}
	});

	test("should handle URLs with hash fragments", () => {
		const html = `<p>Test content</p><img src="/api/media/file/123#section" alt="Image with hash" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
		}
	});

	test("should parse both IDs and filenames regardless of existence", () => {
		const html = `<p>Test content</p><img src="/api/media/file/non-existent-file.png" alt="Non-existent" /><img src="/api/media/file/123" alt="Existing" />`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Should parse both - existence checking is not this function's responsibility
			expect(result.value.ids.length).toBe(1);
			expect(result.value.ids).toContain(123);
			expect(result.value.filenames.length).toBe(1);
			expect(result.value.filenames).toContain("non-existent-file.png");
		}
	});

	test("should handle complex HTML with nested elements", () => {
		const html = `<div><p>Test content</p><div><img src="/api/media/file/123" alt="Nested image" /></div><img src="/api/media/file/456" alt="Another image" /></div>`;

		const result = tryParseMediaFromHtml(html);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ids.length).toBe(2);
			expect(result.value.ids).toContain(123);
			expect(result.value.ids).toContain(456);
		}
	});
});
