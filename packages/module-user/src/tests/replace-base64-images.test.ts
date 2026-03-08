import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import { tryCreateUser } from "../services/user-management";
import Gem from "../fixture/gem.png" with { type: "file" };
import PaideiaLogo from "../fixture/paideia-logo.png" with { type: "file" };
import { createLocalReq } from "@paideia/shared";
import { replaceBase64MediaWithMediaUrlsV2 } from "../internal/utils/replace-base64-images";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { migrations } from "src/migrations";

type TryResultValue<T extends (...args: any) => any> = Exclude<
	NonNullable<Awaited<ReturnType<T>>>["value"],
	undefined
>;

describe("replaceBase64MediaWithMediaUrlsV2", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const infrastructureModule = new InfrastructureModule(payload);
	let testUser: TryResultValue<typeof tryCreateUser>;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({ migrations: migrations as Migration[], forceAcceptWarning: true });
		await infrastructureModule.cleanS3();

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
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should process content with base64 image and create media", async () => {
		const fileBuffer = await Bun.file(Gem).arrayBuffer();
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
		const fileBuffer1 = await Bun.file(Gem).arrayBuffer();
		const fileBuffer2 = await Bun.file(PaideiaLogo).arrayBuffer();
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
		const fileBuffer = await Bun.file(Gem).arrayBuffer();
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
		const fileBuffer = await Bun.file(Gem).arrayBuffer();
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
