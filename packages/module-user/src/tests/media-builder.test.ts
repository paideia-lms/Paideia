import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration } from "payload";
import sanitizedConfig from "payload.config";
import { predefinedMediaSeedData } from "../seeding/predefined-media-seed-data";
import {
	trySeedMedia,
	type SeedMediaResult,
} from "../seeding/media-builder";
import {
	trySeedUsers,
	type SeedUsersResult,
} from "../seeding/users-builder";
import { predefinedUserSeedData } from "../seeding/predefined-user-seed-data";
import { devConstants } from "../utils/constants";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { migrations } from "../migrations";

describe("Media Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: SeedUsersResult;
	let mediaResult: SeedMediaResult;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({ migrations: migrations as Migration[], forceAcceptWarning: true });
		await infrastructureModule.cleanS3();

		usersResult = await trySeedUsers({
			payload,
			data: predefinedUserSeedData,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		mediaResult = await trySeedMedia({
			payload,
			data: predefinedMediaSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		await infrastructureModule.migrateFresh({ migrations: migrations as Migration[], forceAcceptWarning: true });
		await infrastructureModule.cleanS3();
	});

	test("seeds media from predefined data successfully", () => {
		expect(mediaResult.media.length).toBe(
			predefinedMediaSeedData.media.length,
		);
		for (const m of mediaResult.media) {
			expect(m.id).toBeDefined();
			expect(m.filename).toBeDefined();
			expect(m.mimeType).toBeDefined();
			expect(m.createdBy).toBeDefined();
		}
	});

	test("returns correct structure with media and byFilename", () => {
		expect(mediaResult.media).toBeDefined();
		expect(Array.isArray(mediaResult.media)).toBe(true);
		expect(mediaResult.byFilename).toBeInstanceOf(Map);
	});

	test("byFilename lookup works for created media", () => {
		expect(mediaResult.byFilename.get("gem.png")).toBeDefined();
		expect(mediaResult.byFilename.get("paideia-logo.png")).toBeDefined();
	});

	test("createdBy matches seeded user for admin media", () => {
		const gemMedia = mediaResult.getByFilename("gem.png");
		const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
		expect(gemMedia.createdBy).toBe(adminEntry.user.id);
	});

	test("createdBy matches seeded user for regular user media", () => {
		const logoMedia = mediaResult.getByFilename("paideia-logo.png");
		const regularEntry = usersResult.byEmail.get("user@example.com")!;
		expect(logoMedia.createdBy).toBe(regularEntry.user.id);
	});
});
