import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration } from "payload";
import sanitizedConfig from "../payload.config";
import { trySendEmail } from "./email";
import { migrations } from "server/migrations";
import { migrateFresh } from "server/utils/db/migrate-fresh";
import { deleteEverythingInBucket } from "server/utils/s3-client";

describe("Email Management", async () => {
	const payload = await getPayload({
		key: crypto.randomUUID(),
		config: sanitizedConfig,
	});

	beforeAll(async () => {
		await migrateFresh({ payload, migrations : migrations as Migration[] , forceAcceptWarning: true })
		await deleteEverythingInBucket({ logger: payload.logger})
	});

	afterAll(async () => {
		await migrateFresh({ payload, migrations : migrations as Migration[] , forceAcceptWarning: true })
		await deleteEverythingInBucket({ logger: payload.logger})
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
