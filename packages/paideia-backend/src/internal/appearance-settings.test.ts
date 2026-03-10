import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration } from "payload";
import {
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "./appearance-settings";
import { tryCreateMedia, tryFindMediaUsages } from "./media-management";
import { tryCreateUser } from "./user-management";
import { stripDepth, type Depth } from "./utils/internal-function-utils";
import type { User } from "server/payload-types";
import sanitizedConfig from "../payload.config";
import { migrations } from "server/migrations";
import { migrateFresh } from "server/utils/db/migrate-fresh";
import { deleteEverythingInBucket } from "server/utils/s3-client";

describe("Appearance Settings Functions", async () => {
	const payload = await getPayload({
		key: crypto.randomUUID(),
		config: sanitizedConfig,
	});
	let testUser: Depth<
		User & {
			collection: "users";
		},
		0
	>;
	let testUserId: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await migrateFresh({ payload, migrations : migrations as Migration[] , forceAcceptWarning: true })
			await deleteEverythingInBucket({ logger: payload.logger})
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		// Create test user
		const userResult = await tryCreateUser({
			payload,
			data: {
				email: "test-appearance@example.com",
				password: "password123",
				firstName: "Test",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
			req: undefined,
		});

		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUser = {
			...userResult.value,
			collection: "users",
		};
		testUserId = testUser.id;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await migrateFresh({ payload, migrations : migrations as Migration[] , forceAcceptWarning: true })
			await deleteEverythingInBucket({ logger: payload.logger})
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should upload logo and track media usage", async () => {
		// Create media from fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		expect(createMediaResult.ok).toBe(true);
		if (!createMediaResult.ok) throw new Error("Failed to create media");
		const logoMediaId = createMediaResult.value.media.id;

		// Fetch the actual user from database
		const testUser = await payload
			.findByID({
				collection: "users",
				id: testUserId,
				depth: 0,
				overrideAccess: true,
			})
			.then(stripDepth<0, "findByID">());

		// Update appearance settings with logoLight (media ID)
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: logoMediaId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Verify logo was linked
		expect(updateResult.value.logoLight?.id).toBe(logoMediaId);

		// Verify the logo is tracked in media usage
		const findUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoMediaId,
			overrideAccess: true,
			req: undefined,
		});

		expect(findUsagesResult.ok).toBe(true);
		if (!findUsagesResult.ok) {
			throw new Error("Failed to find media usages");
		}

		const { usages, totalUsages } = findUsagesResult.value;

		// Should find at least one usage in appearance-settings
		expect(totalUsages).toBeGreaterThanOrEqual(1);

		// Find the appearance-settings usage
		const appearanceUsage = usages.find(
			(u) =>
				u.collection === "appearance-settings" && u.fieldPath === "logoLight",
		);

		expect(appearanceUsage).toBeDefined();
		expect(appearanceUsage?.documentId).toBeDefined();
	});

	test("should upload multiple logos and track all media usages", async () => {
		// Create media from fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createLogoLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-light-2.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		const createLogoDarkResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-dark.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		const createCompactLogoLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-compact-logo-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		expect(createLogoLightResult.ok).toBe(true);
		expect(createLogoDarkResult.ok).toBe(true);
		expect(createCompactLogoLightResult.ok).toBe(true);
		if (
			!createLogoLightResult.ok ||
			!createLogoDarkResult.ok ||
			!createCompactLogoLightResult.ok
		)
			throw new Error("Failed to create media");

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with multiple logos (media IDs)
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: createLogoLightResult.value.media.id,
				logoDark: createLogoDarkResult.value.media.id,
				compactLogoLight: createCompactLogoLightResult.value.media.id,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Get the created media IDs from the result
		const logoLightId = updateResult.value.logoLight?.id;
		const logoDarkId = updateResult.value.logoDark?.id;
		const compactLogoLightId = updateResult.value.compactLogoLight?.id;

		// Verify all logos were set
		expect(logoLightId).toBeDefined();
		expect(logoDarkId).toBeDefined();
		expect(compactLogoLightId).toBeDefined();

		// Verify each logo is tracked in media usage
		const logoLightUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoLightId!,
			overrideAccess: true,
			req: undefined,
		});

		expect(logoLightUsagesResult.ok).toBe(true);
		if (!logoLightUsagesResult.ok) {
			throw new Error("Failed to find logoLight usages");
		}

		const logoLightUsage = logoLightUsagesResult.value.usages.find(
			(u) =>
				u.collection === "appearance-settings" && u.fieldPath === "logoLight",
		);
		expect(logoLightUsage).toBeDefined();

		const logoDarkUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoDarkId!,
			overrideAccess: true,
			req: undefined,
		});

		expect(logoDarkUsagesResult.ok).toBe(true);
		if (!logoDarkUsagesResult.ok) {
			throw new Error("Failed to find logoDark usages");
		}

		const logoDarkUsage = logoDarkUsagesResult.value.usages.find(
			(u) =>
				u.collection === "appearance-settings" && u.fieldPath === "logoDark",
		);
		expect(logoDarkUsage).toBeDefined();

		const compactLogoLightUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: compactLogoLightId!,
			overrideAccess: true,
			req: undefined,
		});

		expect(compactLogoLightUsagesResult.ok).toBe(true);
		if (!compactLogoLightUsagesResult.ok) {
			throw new Error("Failed to find compactLogoLight usages");
		}

		const compactLogoLightUsage =
			compactLogoLightUsagesResult.value.usages.find(
				(u) =>
					u.collection === "appearance-settings" &&
					u.fieldPath === "compactLogoLight",
			);
		expect(compactLogoLightUsage).toBeDefined();
	});

	test("should handle favicon uploads and track media usage", async () => {
		// Create favicon media from fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createFaviconLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-favicon-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		const createFaviconDarkResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-favicon-dark.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		expect(createFaviconLightResult.ok).toBe(true);
		expect(createFaviconDarkResult.ok).toBe(true);
		if (!createFaviconLightResult.ok || !createFaviconDarkResult.ok)
			throw new Error("Failed to create media");

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with favicons (media IDs)
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				faviconLight: createFaviconLightResult.value.media.id,
				faviconDark: createFaviconDarkResult.value.media.id,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Get the created media IDs from the result
		const faviconLightId = updateResult.value.faviconLight?.id;
		const faviconDarkId = updateResult.value.faviconDark?.id;

		// Verify favicons were set
		expect(faviconLightId).toBeDefined();
		expect(faviconDarkId).toBeDefined();

		// Verify favicons are tracked in media usage
		const faviconLightUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: faviconLightId!,
			overrideAccess: true,
			req: undefined,
		});

		expect(faviconLightUsagesResult.ok).toBe(true);
		if (!faviconLightUsagesResult.ok) {
			throw new Error("Failed to find faviconLight usages");
		}

		const faviconLightUsage = faviconLightUsagesResult.value.usages.find(
			(u) =>
				u.collection === "appearance-settings" &&
				u.fieldPath === "faviconLight",
		);
		expect(faviconLightUsage).toBeDefined();

		const faviconDarkUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: faviconDarkId!,
			overrideAccess: true,
			req: undefined,
		});

		expect(faviconDarkUsagesResult.ok).toBe(true);
		if (!faviconDarkUsagesResult.ok) {
			throw new Error("Failed to find faviconDark usages");
		}

		const faviconDarkUsage = faviconDarkUsagesResult.value.usages.find(
			(u) =>
				u.collection === "appearance-settings" && u.fieldPath === "faviconDark",
		);
		expect(faviconDarkUsage).toBeDefined();
	});

	test("should get appearance settings with logo fields", async () => {
		// Create media from fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-get.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
			req: undefined,
		});
		expect(createMediaResult.ok).toBe(true);
		if (!createMediaResult.ok) throw new Error("Failed to create media");
		const logoMediaId = createMediaResult.value.media.id;

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Set the logo (media ID)
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: logoMediaId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		expect(updateResult.value.logoLight?.id).toBe(logoMediaId);

		// Get settings and verify logo is returned
		const getSettingsResult = await tryGetAppearanceSettings({
			payload,
			overrideAccess: true,
			req: undefined,
		});

		expect(getSettingsResult.ok).toBe(true);
		if (!getSettingsResult.ok) {
			throw new Error("Failed to get appearance settings");
		}

		expect(getSettingsResult.value.logoLight?.id).toBe(logoMediaId);
	});
});
