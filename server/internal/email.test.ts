import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import { trySendEmail } from "./email";

describe("Email Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		payload = await getPayload({
			config: sanitizedConfig,
		});

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
			user: {
				id: 1,
				email: "test@example.com",
				role: "admin",
				collection: "users",
				updatedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
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
			user: {
				id: 1,
				email: "test@example.com",
				role: "admin",
				collection: "users",
				updatedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			},
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Invalid email format");
		}
	});
});
