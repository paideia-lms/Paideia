import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../../../payload.config";
import { predefinedWhiteboardSeedData } from "../seeding/predefined-whiteboard-seed-data";
import {
	trySeedWhiteboards,
	type SeedWhiteboardsResult,
} from "../seeding/whiteboard-builder";
import {
	trySeedUsers,
	type SeedUsersResult,
} from "../../user/seeding/users-builder";
import { predefinedUserSeedData } from "../../user/seeding/predefined-user-seed-data";

describe("Whiteboard Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	let usersResult: SeedUsersResult;
	let whiteboardsResult: SeedWhiteboardsResult;

	beforeAll(async () => {
		while (!payload.db.drizzle) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});

		usersResult = await trySeedUsers({
			payload,
			data: predefinedUserSeedData,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		whiteboardsResult = await trySeedWhiteboards({
			payload,
			data: predefinedWhiteboardSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});
	});

	test("seeds whiteboards from predefined data successfully", () => {
		expect(whiteboardsResult.whiteboards.length).toBe(
			predefinedWhiteboardSeedData.whiteboards.length,
		);
		for (const whiteboard of whiteboardsResult.whiteboards) {
			expect((whiteboard as any).id).toBeDefined();
			expect((whiteboard as any).title).toBeDefined();
			expect((whiteboard as any).createdBy).toBeDefined();
		}
	});

	test("returns correct structure with whiteboards array", () => {
		expect(whiteboardsResult.whiteboards).toBeDefined();
		expect(Array.isArray(whiteboardsResult.whiteboards)).toBe(true);
	});

	test("createdBy matches seeded user for admin whiteboard", () => {
		const adminWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title.includes("Introduction to Mathematics"),
		);
		expect(adminWhiteboard).toBeDefined();
		const adminEntry = usersResult.byEmail.get("instructor@example.com");
		if (adminEntry) {
			expect((adminWhiteboard as any).createdBy).toBe(adminEntry.user.id);
		}
	});

	test("title is set correctly for all whiteboards", () => {
		const titles = whiteboardsResult.whiteboards.map((w) => (w as any).title);
		expect(titles).toContain("Introduction to Mathematics");
		expect(titles).toContain("Physics Lab Notes");
	});

	test("description is set correctly", () => {
		const adminWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title === "Introduction to Mathematics",
		);
		expect(adminWhiteboard).toBeDefined();
		expect((adminWhiteboard as any).description).toBe("A whiteboard for mathematics class");
	});

	test("content is valid JSON", () => {
		const adminWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title === "Introduction to Mathematics",
		);
		expect(adminWhiteboard).toBeDefined();
		expect((adminWhiteboard as any).content).toBeDefined();
		expect(() => JSON.parse((adminWhiteboard as any).content)).not.toThrow();
	});
});
