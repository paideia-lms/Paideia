import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";
import { predefinedFileSeedData } from "../seeding/predefined-file-seed-data";
import {
	trySeedFiles,
	type SeedFilesResult,
} from "../seeding/file-builder";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { devConstants } from "../utils/constants";
import { migrations } from "src/migrations";

describe("File Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: UserModule.SeedUsersResult;
	let filesResult: SeedFilesResult;

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

		filesResult = await trySeedFiles({
			payload,
			data: predefinedFileSeedData,
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

	test("seeds files from predefined data successfully", () => {
		expect(filesResult.files.length).toBe(
			predefinedFileSeedData.files.length,
		);
		for (const file of filesResult.files) {
			expect((file as any).id).toBeDefined();
			expect((file as any).title).toBeDefined();
			expect((file as any).createdBy).toBeDefined();
		}
	});

	test("returns correct structure with files array", () => {
		expect(filesResult.files).toBeDefined();
		expect(Array.isArray(filesResult.files)).toBe(true);
	});

	test("createdBy matches seeded user for admin file", () => {
		const adminFile = filesResult.files.find((f) =>
			(f as any).title.includes("Course Syllabus"),
		);
		expect(adminFile).toBeDefined();
		const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
		expect((adminFile as any).createdBy).toBe(adminEntry.user.id);
	});

	test("createdBy matches seeded user for regular user files", () => {
		const regularEntry = usersResult.byEmail.get("user@example.com")!;
		const userFiles = filesResult.files.filter(
			(f) => (f as any).createdBy === regularEntry.user.id,
		);
		expect(userFiles.length).toBe(2);
		for (const file of userFiles) {
			expect((file as any).createdBy).toBe(regularEntry.user.id);
		}
	});

	test("title is set correctly for all files", () => {
		const titles = filesResult.files.map((f) => (f as any).title);
		expect(titles).toContain("Course Syllabus");
		expect(titles).toContain("Lecture Notes Week 1");
		expect(titles).toContain("Lab Worksheet");
	});

	test("description is set correctly", () => {
		const syllabusFile = filesResult.files.find((f) =>
			(f as any).title === "Course Syllabus",
		);
		expect(syllabusFile).toBeDefined();
		expect((syllabusFile as any).description).toBe(
			"The official course syllabus for this semester",
		);
	});

	test("all files have required fields", () => {
		for (const file of filesResult.files) {
			expect((file as any).id).toBeDefined();
			expect(typeof (file as any).id).toBe("number");
			expect((file as any).createdAt).toBeDefined();
			expect((file as any).updatedAt).toBeDefined();
			expect((file as any).createdBy).toBeDefined();
		}
	});

	test("files are accessible via createdBy relationship", async () => {
		const regularEntry = usersResult.byEmail.get("user@example.com")!;
		
		const userFiles = await payload.find({
			collection: "files",
			where: {
				createdBy: {
					equals: regularEntry.user.id,
				},
			},
			overrideAccess: true,
		});

		expect(userFiles.docs.length).toBe(2);
		expect(userFiles.docs.map((f: any) => f.title)).toContain("Lecture Notes Week 1");
		expect(userFiles.docs.map((f: any) => f.title)).toContain("Lab Worksheet");
	});
});
