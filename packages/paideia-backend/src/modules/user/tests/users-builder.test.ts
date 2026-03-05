import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../../../payload.config";
import { predefinedUserSeedData } from "../seeding/predefined-user-seed-data";
import {
	trySeedUsers,
	type SeedUsersResult,
} from "../seeding/users-builder";
import { devConstants } from "../../../utils/constants";

describe("Users Builder", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let seedResult: SeedUsersResult;

	beforeAll(async () => {
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		seedResult = await trySeedUsers({
			payload,
			data: predefinedUserSeedData,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("seeds users from predefined data successfully", () => {
		expect(seedResult.users.length).toBe(predefinedUserSeedData.users.length);
		for (const entry of seedResult.users) {
			expect(entry.user.id).toBeDefined();
			expect(entry.user.email).toBeDefined();
			expect(entry.user.role).toBeDefined();
		}
	});

	test("returns correct structure with users, byEmail, and admin", () => {
		expect(seedResult.users).toBeDefined();
		expect(Array.isArray(seedResult.users)).toBe(true);
		expect(seedResult.byEmail).toBeInstanceOf(Map);
		expect(seedResult.admin).toBeDefined();
		expect(seedResult.admin?.role).toBe("admin");
	});

	test("admin user has token when login is true", () => {
		const adminEntry = seedResult.users.find(
			(u) => u.user.email === devConstants.ADMIN_EMAIL,
		);
		expect(adminEntry).toBeDefined();
		expect(adminEntry?.token).toBeDefined();
		expect(typeof adminEntry?.token).toBe("string");
	});

	test("user with generateApiKey true receives API key in result", () => {
		const apiKeyUser = seedResult.users.find(
			(u) => u.user.email === "apikey-user-seed@example.com",
		);
		expect(apiKeyUser).toBeDefined();
		expect(apiKeyUser?.apiKey).toBeDefined();
		expect(apiKeyUser?.apiKey).toMatch(/^pld_/);
	});

	test("byEmail lookup works for created users", () => {
		expect(seedResult.byEmail.get(devConstants.ADMIN_EMAIL)).toBeDefined();
		expect(seedResult.byEmail.get("user@example.com")).toBeDefined();
		expect(seedResult.byEmail.get("apikey-user-seed@example.com")).toBeDefined();
		expect(seedResult.byEmail.get(devConstants.ADMIN_EMAIL)?.role).toBe(
			"admin",
		);
	});
});
