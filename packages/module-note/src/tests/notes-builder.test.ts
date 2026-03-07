import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, Migration } from "payload";
import type { User } from "payload-types";
import sanitizedConfig from "payload.config";
import { predefinedNoteSeedData } from "../seeding/predefined-note-seed-data";
import {
	trySeedNotes,
	type SeedNotesResult,
} from "../seeding/notes-builder";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { devConstants } from "../utils/constants";
import { migrations } from "src/migrations";

describe("Notes Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: { byEmail: Map<string, { user: User }>; getUsersByEmail: () => Map<string, User> };
	let notesResult: SeedNotesResult;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
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

		notesResult = await trySeedNotes({
			payload,
			data: predefinedNoteSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();
	});

	test("seeds notes from predefined data successfully", () => {
		expect(notesResult.notes.length).toBe(predefinedNoteSeedData.notes.length);
		for (const note of notesResult.notes) {
			expect(note.id).toBeDefined();
			expect(note.content).toBeDefined();
			expect(note.createdBy).toBeDefined();
		}
	});

	test("returns correct structure with notes array", () => {
		expect(notesResult.notes).toBeDefined();
		expect(Array.isArray(notesResult.notes)).toBe(true);
	});

	test("createdBy matches seeded user for admin note", () => {
		const adminNote = notesResult.notes.find((n) =>
			n.content.includes("Admin's First Note"),
		);
		expect(adminNote).toBeDefined();
		const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
		expect(adminNote!.createdBy).toBe(adminEntry.user.id);
	});

	test("createdBy matches seeded user for regular user notes", () => {
		const regularEntry = usersResult.byEmail.get("user@example.com");
		if (!regularEntry) throw new Error("user@example.com not found");
		const userNotes = notesResult.notes.filter(
			(n) => n.createdBy === regularEntry.user.id,
		);
		expect(userNotes.length).toBe(2);
		for (const note of userNotes) {
			expect(note.createdBy).toBe(regularEntry.user.id);
		}
	});

	test("isPublic is set correctly", () => {
		const publicNotes = notesResult.notes.filter((n) => n.isPublic === true);
		expect(publicNotes.length).toBe(2);
		const privateNotes = notesResult.notes.filter((n) => n.isPublic === false);
		expect(privateNotes.length).toBe(1);
	});
});
