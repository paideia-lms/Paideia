import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";
import { trySendEmail } from "../services/email";

describe("Email Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		payload = await getPayload({
			key: `test-${Math.random().toString(36).substring(2, 15)}`,
			config: sanitizedConfig,
		});

		// await until payload.db.drizzle is ready
		while (!payload.db.drizzle) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});
	});

	afterAll(async () => {
		if (payload.db && typeof payload.db.destroy === "function") {
			await payload.db.destroy();
		}
	});

	test("should fail when recipient email is missing", async () => {
		const result = await trySendEmail({
			payload,
			to: "",
			subject: "Test Subject",
			html: "<p>Test Body</p>",
			req: {
				user: {
					id: 1,
					email: "test@example.com",
					role: "admin",
					collection: "users",
					theme: "light",
					direction: "ltr",
					updatedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
				},
			},
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Recipient email is required");
		}
	});

	test("should fail when recipient email format is invalid", async () => {
		const result = await trySendEmail({
			payload,
			to: "invalid-email",
			subject: "Test Subject",
			html: "<p>Test Body</p>",
			req: {
				user: {
					id: 1,
					email: "test@example.com",
					role: "admin",
					collection: "users",
					theme: "light",
					direction: "ltr",
					updatedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
				},
			},
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Invalid email format");
		}
	});
});
