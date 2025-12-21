import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import {
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "./appearance-settings";
import { tryFindMediaUsages } from "./media-management";
import { tryCreateUser } from "./user-management";
import { stripDepth, type Depth } from "./utils/internal-function-utils";
import type { User } from "server/payload-types";

describe("Appearance Settings Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
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

		testUser = {
			...userResult.value,
			collection: "users",
		};
		testUserId = testUser.id;
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
		// Create a File object from the fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const logoFile = new File([fileBuffer], "test-logo-light.png", {
			type: "image/png",
		});

		// Fetch the actual user from database
		const testUser = await payload
			.findByID({
				collection: "users",
				id: testUserId,
				depth: 0,
				overrideAccess: true,
			})
			.then(stripDepth<0, "findByID">());

		// Update appearance settings with logoLight
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: logoFile,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		// Get the created media ID from the result
		const logoMediaId = updateResult.value.logoLight?.id;
		expect(logoMediaId).toBeDefined();

		// Verify the logo is tracked in media usage
		const findUsagesResult = await tryFindMediaUsages({
			payload,
			mediaId: logoMediaId!,
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
		// Create multiple File objects from the fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();

		const logoLightFile = new File([fileBuffer], "test-logo-light-2.png", {
			type: "image/png",
		});

		const logoDarkFile = new File([fileBuffer], "test-logo-dark.png", {
			type: "image/png",
		});

		const compactLogoLightFile = new File(
			[fileBuffer],
			"test-compact-logo-light.png",
			{
				type: "image/png",
			},
		);

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with multiple logos
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: logoLightFile,
				logoDark: logoDarkFile,
				compactLogoLight: compactLogoLightFile,
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
		// Create favicon File objects from the fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();

		const faviconLightFile = new File([fileBuffer], "test-favicon-light.png", {
			type: "image/png",
		});

		const faviconDarkFile = new File([fileBuffer], "test-favicon-dark.png", {
			type: "image/png",
		});

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Update appearance settings with favicons
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				faviconLight: faviconLightFile,
				faviconDark: faviconDarkFile,
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
		// Create a File object from the fixture
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const logoFile = new File([fileBuffer], "test-logo-get.png", {
			type: "image/png",
		});

		// Fetch the actual user from database
		const testUser = await payload.findByID({
			collection: "users",
			id: testUserId,
			overrideAccess: true,
		});

		// Set the logo
		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			req: { user: { ...testUser, collection: "users" } },
			data: {
				logoLight: logoFile,
			},
			overrideAccess: false,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) {
			throw new Error("Failed to update appearance settings");
		}

		const logoMediaId = updateResult.value.logoLight?.id;
		expect(logoMediaId).toBeDefined();

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
