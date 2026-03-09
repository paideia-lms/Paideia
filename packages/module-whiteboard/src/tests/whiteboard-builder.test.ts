import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";
import { predefinedWhiteboardSeedData } from "../seeding/predefined-whiteboard-seed-data";
import {
	trySeedWhiteboards,
	type SeedWhiteboardsResult,
} from "../seeding/whiteboard-builder";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { devConstants } from "../utils/constants";
import { migrations } from "src/migrations";

describe("Whiteboard Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: UserModule.SeedUsersResult;
	let whiteboardsResult: SeedWhiteboardsResult;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as import("payload").Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		usersResult = (
			await userModule.seedUsers({
				data: UserModule.seedData.users,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		whiteboardsResult = await trySeedWhiteboards({
			payload,
			data: predefinedWhiteboardSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as import("payload").Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
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

	test("createdBy matches seeded user for instructor whiteboard", () => {
		const instructorWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title.includes("Introduction to Mathematics"),
		);
		expect(instructorWhiteboard).toBeDefined();
		const instructorEntry = usersResult.byEmail.get("instructor@example.com")!;
		expect((instructorWhiteboard as any).createdBy).toBe(instructorEntry.user.id);
	});

	test("title is set correctly for all whiteboards", () => {
		const titles = whiteboardsResult.whiteboards.map((w) => (w as any).title);
		expect(titles).toContain("Introduction to Mathematics");
		expect(titles).toContain("Physics Lab Notes");
	});

	test("description is set correctly", () => {
		const mathWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title === "Introduction to Mathematics",
		);
		expect(mathWhiteboard).toBeDefined();
		expect((mathWhiteboard as any).description).toBe("A whiteboard for mathematics class");
	});

	test("content is valid JSON", () => {
		const mathWhiteboard = whiteboardsResult.whiteboards.find((w) =>
			(w as any).title === "Introduction to Mathematics",
		);
		expect(mathWhiteboard).toBeDefined();
		expect((mathWhiteboard as any).content).toBeDefined();
		expect(() => JSON.parse((mathWhiteboard as any).content)).not.toThrow();
	});

	test("all whiteboards have required fields", () => {
		for (const whiteboard of whiteboardsResult.whiteboards) {
			expect((whiteboard as any).id).toBeDefined();
			expect(typeof (whiteboard as any).id).toBe("number");
			expect((whiteboard as any).createdAt).toBeDefined();
			expect((whiteboard as any).updatedAt).toBeDefined();
			expect((whiteboard as any).createdBy).toBeDefined();
		}
	});

	test("whiteboards are accessible via createdBy relationship", async () => {
		const instructorEntry = usersResult.byEmail.get("instructor@example.com")!;
		
		const userWhiteboards = await payload.find({
			collection: "whiteboards",
			where: {
				createdBy: {
					equals: instructorEntry.user.id,
				},
			},
			overrideAccess: true,
		});

		expect(userWhiteboards.docs.length).toBe(2);
		expect(userWhiteboards.docs.map((w: any) => w.title)).toContain("Introduction to Mathematics");
		expect(userWhiteboards.docs.map((w: any) => w.title)).toContain("Physics Lab Notes");
	});
});
