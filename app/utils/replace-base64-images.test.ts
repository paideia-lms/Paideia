import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../../server/payload.config";
import { tryCreateUser } from "../../server/internal/user-management";
import type { TryResultValue } from "../../server/utils/type-narrowing";
import { createLocalReq } from "../../server/internal/utils/internal-function-utils";
import {
	replaceBase64ImagesWithMediaUrls,
	replaceBase64MediaWithMediaUrlsV2,
} from "./replace-base64-images";
import type { UploadedMediaInfo } from "./upload-handler";

describe("replaceBase64ImagesWithMediaUrls", () => {
	const base64Image1 =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
	const base64Image2 =
		"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

	test("should return content as-is when uploadedMedia is empty", () => {
		const content =
			'<p>Some text <img src="data:image/png;base64,test123" /></p>';
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

describe("replaceBase64MediaWithMediaUrlsV2", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: TryResultValue<typeof tryCreateUser>;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create test user
		testUser = await tryCreateUser({
			payload,
			data: {
				email: "test-user-v2@test.com",
				password: "password123",
				firstName: "Test",
				lastName: "User",
				role: "student",
			},
			overrideAccess: true,
		}).getOrThrow();
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should process content with base64 image and create media", async () => {
		// Create base64 image from fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const base64Image = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
		const content = `<p>Test description with image</p><img src="${base64Image}" alt="Test image" />`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify processed content has media URL instead of base64
		expect(result.processedContent).toBeDefined();
		expect(result.processedContent).not.toContain("data:image");
		expect(result.processedContent).toContain("/api/media/file/");

		// Verify media was created
		expect(result.uploadedMedia.length).toBe(1);
		expect(result.uploadedMedia[0]?.mediaId).toBeDefined();
		expect(result.uploadedMedia[0]?.filename).toBeDefined();
	});

	test("should process content with multiple base64 images", async () => {
		// Create multiple base64 images
		const fileBuffer1 = await Bun.file("fixture/gem.png").arrayBuffer();
		const fileBuffer2 = await Bun.file(
			"fixture/paideia-logo.png",
		).arrayBuffer();
		const base64Image1 = `data:image/png;base64,${Buffer.from(fileBuffer1).toString("base64")}`;
		const base64Image2 = `data:image/png;base64,${Buffer.from(fileBuffer2).toString("base64")}`;

		const content = `<p>Content with multiple images</p><img src="${base64Image1}" alt="Image 1" /><img src="${base64Image2}" alt="Image 2" />`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify processed content
		expect(result.processedContent).toBeDefined();
		expect(result.processedContent).not.toContain("data:image");
		expect(result.processedContent).toContain("/api/media/file/");

		// Verify both images were created
		expect(result.uploadedMedia.length).toBe(2);
	});

	test("should handle empty content", async () => {
		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content: "",
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify empty content is handled
		expect(result.processedContent).toBe("");

		// Verify no media was created
		expect(result.uploadedMedia.length).toBe(0);
	});

	test("should handle content without base64 images", async () => {
		const content = `<p>Plain text content without images</p>`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify content is unchanged
		expect(result.processedContent).toBe(content);

		// Verify no media was created
		expect(result.uploadedMedia.length).toBe(0);
	});

	test("should use custom alt text", async () => {
		// Create base64 image
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const base64Image = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
		const content = `<p>Test description</p><img src="${base64Image}" alt="Test image" />`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const customAlt = "Custom alt text";

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			alt: customAlt,
			req,
			overrideAccess: true,
		});

		// Verify media was created
		expect(result.uploadedMedia.length).toBe(1);

		// Verify the media record has the custom alt text
		if (result.uploadedMedia[0]?.mediaId) {
			const media = await payload.findByID({
				collection: "media",
				id: result.uploadedMedia[0].mediaId,
				depth: 0,
			});
			expect(media.alt).toBe(customAlt);
		}
	});

	test("should handle different mime types", async () => {
		// Create a simple base64 image (1x1 pixel PNG)
		const tinyPngBase64 =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
		const base64Image = `data:image/png;base64,${tinyPngBase64}`;
		const content = `<p>Test with PNG image</p><img src="${base64Image}" alt="PNG image" />`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify processed content
		expect(result.processedContent).toBeDefined();
		expect(result.processedContent).not.toContain("data:image");
		expect(result.processedContent).toContain("/api/media/file/");

		// Verify media was created with correct mime type
		expect(result.uploadedMedia.length).toBe(1);
		if (result.uploadedMedia[0]?.mediaId) {
			const media = await payload.findByID({
				collection: "media",
				id: result.uploadedMedia[0].mediaId,
				depth: 0,
			});
			expect(media.mimeType).toBe("image/png");
		}
	});

	test("should preserve HTML structure after processing", async () => {
		// Create base64 image
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const base64Image = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
		const content = `<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p><img src="${base64Image}" alt="Test" /><p>More text after image.</p></div>`;

		const req = createLocalReq({
			user: testUser as TypedUser,
			request: new Request("http://localhost:3000/api/test"),
		});

		const result = await replaceBase64MediaWithMediaUrlsV2({
			content,
			payload,
			userId: testUser.id,
			req,
			overrideAccess: true,
		});

		// Verify HTML structure is preserved
		expect(result.processedContent).toBeDefined();
		expect(result.processedContent).toContain("<h1>Title</h1>");
		expect(result.processedContent).toContain("<strong>bold</strong>");
		expect(result.processedContent).toContain("More text after image");
		expect(result.processedContent).not.toContain("data:image");
		expect(result.processedContent).toContain("/api/media/file/");
	});
});
