import { describe, expect, test } from "bun:test";
import { replaceBase64ImagesWithMediaUrls } from "./replace-base64-images";
import type { UploadedMediaInfo } from "./upload-handler";

describe("replaceBase64ImagesWithMediaUrls", () => {
	const base64Image1 =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
	const base64Image2 =
		"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

	test("should return content as-is when uploadedMedia is empty", () => {
		const content = '<p>Some text <img src="data:image/png;base64,test123" /></p>';
		const formData = new FormData();

		const result = replaceBase64ImagesWithMediaUrls(content, [], formData);

		expect(result).toBe(content);
	});

	test("should replace base64 images with media URLs using FormData", () => {
		const content = `<p>Some text <img src="${base64Image1}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const formData = new FormData();
		formData.append("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			formData,
		);

		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain("data:image");
	});

	test("should replace base64 images with media URLs using Map", () => {
		const content = `<p>Some text <img src="${base64Image1}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain("data:image");
	});

	test("should replace base64 images with media URLs using Record", () => {
		const content = `<p>Some text <img src="${base64Image1}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewRecord: Record<string, string> = {
			"image-0-preview": base64Image1,
		};

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewRecord,
		);

		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain("data:image");
	});

	test("should replace multiple base64 images", () => {
		const content = `<div>
			<p>First image: <img src="${base64Image1}" alt="First" /></p>
			<p>Second image: <img src="${base64Image2}" alt="Second" /></p>
		</div>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
			{
				fieldName: "image-1",
				mediaId: 2,
				filename: "test-image-2.jpg",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);
		previewMap.set("image-1-preview", base64Image2);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).toContain("/api/media/file/test-image-2.jpg");
		expect(result).not.toContain("data:image");
	});

	test("should not replace images without matching preview data", () => {
		const content = `<p>Some text <img src="${base64Image1}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		// No preview data for image-0

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("data:image");
		expect(result).not.toContain("/api/media/file");
	});

	test("should not replace non-base64 images", () => {
		const content = `<p>
			<img src="https://example.com/image.png" alt="External" />
			<img src="/api/media/file/existing.png" alt="Existing" />
			<img src="${base64Image1}" alt="Base64" />
		</p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("https://example.com/image.png");
		expect(result).toContain("/api/media/file/existing.png");
		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain(base64Image1);
	});

	test("should handle HTML with no images", () => {
		const content = "<p>Some text without images</p>";
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toBe("<p>Some text without images</p>");
	});

	test("should handle HTML with mixed content", () => {
		const content = `<div>
			<h1>Title</h1>
			<p>Paragraph with <strong>bold</strong> text.</p>
			<img src="${base64Image1}" alt="Test" />
			<p>More text after image.</p>
		</div>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("<h1>Title</h1>");
		expect(result).toContain("<strong>bold</strong>");
		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).toContain("More text after image");
		expect(result).not.toContain("data:image");
	});

	test("should match images by first 100 characters of base64 prefix", () => {
		const longBase64 = base64Image1 + "extra-data-that-should-be-ignored";
		const content = `<p><img src="${longBase64}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		// Should match based on first 100 characters
		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain("data:image");
	});

	test("should handle description-image-* field names", () => {
		const content = `<p><img src="${base64Image1}" alt="Test" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "description-image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("description-image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain("/api/media/file/test-image-1.png");
		expect(result).not.toContain("data:image");
	});

	test("should preserve image attributes other than src", () => {
		const content = `<p><img src="${base64Image1}" alt="Test Image" class="my-class" id="img-1" width="100" height="200" /></p>`;
		const uploadedMedia: UploadedMediaInfo[] = [
			{
				fieldName: "image-0",
				mediaId: 1,
				filename: "test-image-1.png",
			},
		];
		const previewMap = new Map<string, string>();
		previewMap.set("image-0-preview", base64Image1);

		const result = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			previewMap,
		);

		expect(result).toContain('alt="Test Image"');
		expect(result).toContain('class="my-class"');
		expect(result).toContain('id="img-1"');
		expect(result).toContain('width="100"');
		expect(result).toContain('height="200"');
		expect(result).toContain("/api/media/file/test-image-1.png");
	});
});

