import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import {
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "./appearance-settings";
import { tryCreateMedia, tryFindMediaUsages } from "./media-management";
import { tryCreateUser } from "./user-management";

describe("Appearance Settings Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUserId: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: config,
		});

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
		});

		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUserId = userResult.value.id;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should upload logo and track media usage", async () => {
		// Create a test media file (logo)
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		expect(createMediaResult.ok).toBe(true);
		if (!createMediaResult.ok) {
			throw new Error("Failed to create test media");
		}

		const logoMediaId = createMediaResult.value.media.id;

		// Get current appearance settings
		const getSettingsResult = await tryGetAppearanceSettings({
			payload,
			overrideAccess: true,
		});

		expect(getSettingsResult.ok).toBe(true);
		if (!getSettingsResult.ok) {
			throw new Error("Failed to get appearance settings");
		}

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with logoLight
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			user: testUser,
			data: {
				logoLight: logoMediaId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Verify logoLight was set
		expect(updateResult.value.logoLight?.id).toBe(logoMediaId);

		// Verify the logo is tracked in media usage
		const findUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoMediaId,
			overrideAccess: true,
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
		// Create multiple logo media files
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();

		const logoLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-light-2.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		const logoDarkResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-dark.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		const compactLogoLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-compact-logo-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		expect(logoLightResult.ok).toBe(true);
		expect(logoDarkResult.ok).toBe(true);
		expect(compactLogoLightResult.ok).toBe(true);

		if (
			!logoLightResult.ok ||
			!logoDarkResult.ok ||
			!compactLogoLightResult.ok
		) {
			throw new Error("Failed to create test media");
		}

		const logoLightId = logoLightResult.value.media.id;
		const logoDarkId = logoDarkResult.value.media.id;
		const compactLogoLightId = compactLogoLightResult.value.media.id;

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with multiple logos
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			user: testUser,
			data: {
				logoLight: logoLightId,
				logoDark: logoDarkId,
				compactLogoLight: compactLogoLightId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Verify all logos were set
		expect(updateResult.value.logoLight?.id).toBe(logoLightId);
		expect(updateResult.value.logoDark?.id).toBe(logoDarkId);
		expect(updateResult.value.compactLogoLight?.id).toBe(compactLogoLightId);

		// Verify each logo is tracked in media usage
		const logoLightUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoLightId,
			overrideAccess: true,
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
			mediaId: logoDarkId,
			overrideAccess: true,
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
			mediaId: compactLogoLightId,
			overrideAccess: true,
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
		// Create favicon media files
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();

		const faviconLightResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-favicon-light.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		const faviconDarkResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-favicon-dark.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		expect(faviconLightResult.ok).toBe(true);
		expect(faviconDarkResult.ok).toBe(true);

		if (!faviconLightResult.ok || !faviconDarkResult.ok) {
			throw new Error("Failed to create test media");
		}

		const faviconLightId = faviconLightResult.value.media.id;
		const faviconDarkId = faviconDarkResult.value.media.id;

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with favicons
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			user: testUser,
			data: {
				faviconLight: faviconLightId,
				faviconDark: faviconDarkId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Verify favicons were set
		expect(updateResult.value.faviconLight?.id).toBe(faviconLightId);
		expect(updateResult.value.faviconDark?.id).toBe(faviconDarkId);

		// Verify favicons are tracked in media usage
		const faviconLightUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: faviconLightId,
			overrideAccess: true,
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
			mediaId: faviconDarkId,
			overrideAccess: true,
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
		// Create a test logo
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-logo-get.png",
			mimeType: "image/png",
			userId: testUserId,
			overrideAccess: true,
		});

		expect(createMediaResult.ok).toBe(true);
		if (!createMediaResult.ok) {
			throw new Error("Failed to create test media");
		}

		const logoMediaId = createMediaResult.value.media.id;

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Set the logo
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			user: testUser,
			data: {
				logoLight: logoMediaId,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);

		// Get settings and verify logo is returned
		const getSettingsResult = await tryGetAppearanceSettings({
			payload,
			overrideAccess: true,
		});

		expect(getSettingsResult.ok).toBe(true);
		if (!getSettingsResult.ok) {
			throw new Error("Failed to get appearance settings");
		}

		expect(getSettingsResult.value.logoLight?.id).toBe(logoMediaId);
	});
});
