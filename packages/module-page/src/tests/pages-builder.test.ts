import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";
import { predefinedPageSeedData } from "../seeding/predefined-page-seed-data";
import {
	trySeedPages,
	type SeedPagesResult,
} from "../seeding/pages-builder";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { devConstants } from "../utils/constants";
import { migrations } from "src/migrations";

describe("Pages Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: UserModule.SeedUsersResult;
	let pagesResult: SeedPagesResult;

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

		pagesResult = await trySeedPages({
			payload,
			data: predefinedPageSeedData,
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

	test("seeds pages from predefined data successfully", () => {
		expect(pagesResult.pages.length).toBe(
			predefinedPageSeedData.pages.length,
		);
		for (const page of pagesResult.pages) {
			expect(page.id).toBeDefined();
			expect(page.title).toBeDefined();
			expect(page.createdBy).toBeDefined();
		}
	});

	test("returns correct structure with pages array", () => {
		expect(pagesResult.pages).toBeDefined();
		expect(Array.isArray(pagesResult.pages)).toBe(true);
	});

	test("createdBy matches seeded user for admin page", () => {
		const adminPage = pagesResult.pages.find((p) =>
			(p as any).title.includes("Getting Started with Paideia"),
		);
		expect(adminPage).toBeDefined();
		const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
		expect(adminPage!.createdBy).toBe(adminEntry.user.id);
	});

	test("createdBy matches seeded user for regular user pages", () => {
		const regularEntry = usersResult.byEmail.get("user@example.com")!;
		const userPages = pagesResult.pages.filter(
			(p) => p.createdBy === regularEntry.user.id,
		);
		expect(userPages.length).toBe(2);
		for (const page of userPages) {
			expect(page.createdBy).toBe(regularEntry.user.id);
		}
	});

	test("title is set correctly for all pages", () => {
		const titles = pagesResult.pages.map((p) => (p as any).title);
		expect(titles).toContain("Getting Started with Paideia");
		expect(titles).toContain("Study Tips for Success");
		expect(titles).toContain("Quick Reference Guide");
	});

	test("description is set correctly", () => {
		const adminPage = pagesResult.pages.find((p) =>
			(p as any).title === "Getting Started with Paideia",
		);
		expect(adminPage).toBeDefined();
		expect((adminPage! as any).description).toBe(
			"A comprehensive guide to help you begin your learning journey",
		);
	});

	test("content is set correctly", () => {
		const studyTipsPage = pagesResult.pages.find((p) =>
			(p as any).title === "Study Tips for Success",
		);
		expect(studyTipsPage).toBeDefined();
		expect((studyTipsPage! as any).content).toContain("Study Tips");
		expect((studyTipsPage! as any).content).toContain("Set clear goals");
	});

	test("all pages have required fields", () => {
		for (const page of pagesResult.pages) {
			expect(page.id).toBeDefined();
			expect(typeof page.id).toBe("number");
			expect(page.createdAt).toBeDefined();
			expect(page.updatedAt).toBeDefined();
			expect(page.createdBy).toBeDefined();
		}
	});

	test("pages are accessible via createdBy relationship", async () => {
		const regularEntry = usersResult.byEmail.get("user@example.com")!;
		
		const userPages = await payload.find({
			collection: "pages",
			where: {
				createdBy: {
					equals: regularEntry.user.id,
				},
			},
			overrideAccess: true,
		});

		expect(userPages.docs.length).toBe(2);
		expect(userPages.docs.map((p: any) => p.title)).toContain("Study Tips for Success");
		expect(userPages.docs.map((p: any) => p.title)).toContain("Quick Reference Guide");
	});
});
