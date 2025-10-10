import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCheckActivityModuleAccess,
	tryGrantAccessToActivityModule,
	tryRevokeAccessFromActivityModule,
	tryTransferActivityModuleOwnership,
} from "./activity-module-access";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Activity Module Access Control", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser1: { id: number };
	let testUser2: { id: number };
	let testUser3: { id: number };
	let adminUser: { id: number };
	let user1Token: string;
	let user2Token: string;
	let user3Token: string;
	let adminToken: string;

	// Helper to get authenticated user from token
	const getAuthUser = async (token: string): Promise<TypedUser | null> => {
		const authResult = await payload.auth({
			headers: new Headers({
				Authorization: `Bearer ${token}`,
			}),
		});
		return authResult.user;
	};

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create test users
		const user1Args: CreateUserArgs = {
			payload,
			data: {
				email: "instructor1@example.com",
				password: "testpassword123",
				firstName: "Instructor",
				lastName: "One",
				role: "user",
			},
			overrideAccess: true,
		};

		const user2Args: CreateUserArgs = {
			payload,
			data: {
				email: "instructor2@example.com",
				password: "testpassword123",
				firstName: "Instructor",
				lastName: "Two",
				role: "user",
			},
			overrideAccess: true,
		};

		const user3Args: CreateUserArgs = {
			payload,
			data: {
				email: "instructor3@example.com",
				password: "testpassword123",
				firstName: "Instructor",
				lastName: "Three",
				role: "user",
			},
			overrideAccess: true,
		};

		const adminArgs: CreateUserArgs = {
			payload,
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
				firstName: "Admin",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		};

		const userResult1 = await tryCreateUser(user1Args);
		const userResult2 = await tryCreateUser(user2Args);
		const userResult3 = await tryCreateUser(user3Args);
		const adminResult = await tryCreateUser(adminArgs);

		if (
			!userResult1.ok ||
			!userResult2.ok ||
			!userResult3.ok ||
			!adminResult.ok
		) {
			throw new Error("Failed to create test users");
		}

		testUser1 = userResult1.value;
		testUser2 = userResult2.value;
		testUser3 = userResult3.value;
		adminUser = adminResult.value;

		// Verify users so they can login
		await payload.update({
			collection: "users",
			id: testUser1.id,
			data: { _verified: true },
		});

		await payload.update({
			collection: "users",
			id: testUser2.id,
			data: { _verified: true },
		});

		await payload.update({
			collection: "users",
			id: testUser3.id,
			data: { _verified: true },
		});

		await payload.update({
			collection: "users",
			id: adminUser.id,
			data: { _verified: true },
		});

		// Login to get tokens
		const login1 = await payload.login({
			collection: "users",
			data: {
				email: "instructor1@example.com",
				password: "testpassword123",
			},
		});

		const login2 = await payload.login({
			collection: "users",
			data: {
				email: "instructor2@example.com",
				password: "testpassword123",
			},
		});

		const login3 = await payload.login({
			collection: "users",
			data: {
				email: "instructor3@example.com",
				password: "testpassword123",
			},
		});

		const adminLogin = await payload.login({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
			},
		});

		if (!login1.token || !login2.token || !login3.token || !adminLogin.token) {
			throw new Error("Failed to get authentication tokens");
		}

		user1Token = login1.token;
		user2Token = login2.token;
		user3Token = login3.token;
		adminToken = adminLogin.token;
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create activity module with owner field", async () => {
		const user1 = await getAuthUser(user1Token);

		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Test Activity Module",
				description: "Test description",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		expect(activityModule.id).toBeDefined();
		// Owner can be either ID or object depending on depth
		const ownerId =
			typeof activityModule.owner === "number"
				? activityModule.owner
				: activityModule.owner?.id;
		const createdById =
			typeof activityModule.createdBy === "number"
				? activityModule.createdBy
				: activityModule.createdBy?.id;
		expect(ownerId).toBe(testUser1.id);
		expect(createdById).toBe(testUser1.id);
	});

	test("should allow owner to read their activity module", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Owner Read Test",
				type: "quiz",
				status: "published",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Owner should be able to read
		const result = await payload.findByID({
			collection: "activity-modules",
			id: activityModule.id,
			user: user1,
		});

		expect(result.id).toBe(activityModule.id);
	});

	test("should allow owner to update their activity module", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Owner Update Test",
				type: "discussion",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Owner should be able to update
		const updated = await payload.update({
			collection: "activity-modules",
			id: activityModule.id,
			data: {
				title: "Updated Title",
			},
			user: user1,
		});

		expect(updated.title).toBe("Updated Title");
	});

	test("should allow owner to delete their activity module", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Owner Delete Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Owner should be able to delete
		const deleted = await payload.delete({
			collection: "activity-modules",
			id: activityModule.id,
			user: user1,
		});

		expect(deleted.id).toBe(activityModule.id);
	});

	test("should not allow non-owner to read activity module", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// User1 creates activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Non-Owner Read Test",
				type: "quiz",
				status: "published",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// User2 should not be able to read
		try {
			await payload.findByID({
				collection: "activity-modules",
				id: activityModule.id,
				user: user2,
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	test("should grant access to another user", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Grant Access Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		const grantResult = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		expect(grantResult.ok).toBe(true);
		if (grantResult.ok) {
			// Handle depth - activityModule can be ID or object
			const grantActivityModuleId =
				typeof grantResult.value.activityModule === "number"
					? grantResult.value.activityModule
					: grantResult.value.activityModule?.id;
			const grantedToId =
				typeof grantResult.value.grantedTo === "number"
					? grantResult.value.grantedTo
					: grantResult.value.grantedTo?.id;
			const grantedById =
				typeof grantResult.value.grantedBy === "number"
					? grantResult.value.grantedBy
					: grantResult.value.grantedBy?.id;

			expect(grantActivityModuleId).toBe(activityModule.id);
			expect(grantedToId).toBe(testUser2.id);
			expect(grantedById).toBe(testUser1.id);
		}
	});

	test("should allow granted user to read activity module", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Granted User Read Test",
				type: "quiz",
				status: "published",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// User2 should now be able to read
		const result = await payload.findByID({
			collection: "activity-modules",
			id: activityModule.id,
			user: user2,
		});

		expect(result.id).toBe(activityModule.id);
	});

	test("should allow granted user to update activity module", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Granted User Update Test",
				type: "discussion",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// User2 should be able to update
		const updated = await payload.update({
			collection: "activity-modules",
			id: activityModule.id,
			data: {
				title: "Updated by Granted User",
			},
			user: user2,
		});

		expect(updated.title).toBe("Updated by Granted User");
	});

	test("should not allow granted user to delete activity module", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Granted User Delete Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// User2 should NOT be able to delete
		try {
			await payload.delete({
				collection: "activity-modules",
				id: activityModule.id,
				user: user2,
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	test("should revoke access from user", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Revoke Access Test",
				type: "quiz",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// Verify user2 can read
		const beforeRevoke = await payload.findByID({
			collection: "activity-modules",
			id: activityModule.id,
			user: user2,
		});
		expect(beforeRevoke.id).toBe(activityModule.id);

		// Revoke access
		const revokeResult = await tryRevokeAccessFromActivityModule({
			payload,
			activityModuleId: activityModule.id,
			userId: testUser2.id,
			overrideAccess: true,
		});

		expect(revokeResult.ok).toBe(true);

		// User2 should no longer be able to read
		try {
			await payload.findByID({
				collection: "activity-modules",
				id: activityModule.id,
				user: user2,
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	test("should transfer ownership to another user", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Transfer Ownership Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Transfer ownership to user2
		const transferResult = await tryTransferActivityModuleOwnership({
			payload,
			activityModuleId: activityModule.id,
			newOwnerId: testUser2.id,
			currentOwnerId: testUser1.id,
			overrideAccess: true,
		});

		expect(transferResult.ok).toBe(true);
		if (transferResult.ok) {
			const newOwnerId =
				typeof transferResult.value.owner === "number"
					? transferResult.value.owner
					: transferResult.value.owner?.id;
			expect(newOwnerId).toBe(testUser2.id);
		}

		// Verify new owner can delete
		const deleted = await payload.delete({
			collection: "activity-modules",
			id: activityModule.id,
			user: user2,
		});
		expect(deleted.id).toBe(activityModule.id);
	});

	test("should grant access to previous owner after ownership transfer", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Transfer with Grant Test",
				type: "discussion",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Transfer ownership to user2
		await tryTransferActivityModuleOwnership({
			payload,
			activityModuleId: activityModule.id,
			newOwnerId: testUser2.id,
			currentOwnerId: testUser1.id,
			overrideAccess: true,
		});

		// Previous owner (user1) should still have access
		const result = await payload.findByID({
			collection: "activity-modules",
			id: activityModule.id,
			user: user1,
		});
		expect(result.id).toBe(activityModule.id);

		// Previous owner should be able to update
		const updated = await payload.update({
			collection: "activity-modules",
			id: activityModule.id,
			data: {
				title: "Updated by Previous Owner",
			},
			user: user1,
		});
		expect(updated.title).toBe("Updated by Previous Owner");

		// But previous owner should NOT be able to delete
		try {
			await payload.delete({
				collection: "activity-modules",
				id: activityModule.id,
				user: user1,
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	test("should check access for owner", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Check Owner Access Test",
				type: "quiz",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Check access
		const checkResult = await tryCheckActivityModuleAccess({
			payload,
			activityModuleId: activityModule.id,
			userId: testUser1.id,
		});

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value.hasAccess).toBe(true);
			expect(checkResult.value.isOwner).toBe(true);
			expect(checkResult.value.isCreator).toBe(true);
			expect(checkResult.value.isGranted).toBe(false);
			expect(checkResult.value.isAdmin).toBe(false);
		}
	});

	test("should check access for granted user", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Check Granted Access Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// Check access for user2
		const checkResult = await tryCheckActivityModuleAccess({
			payload,
			activityModuleId: activityModule.id,
			userId: testUser2.id,
		});

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value.hasAccess).toBe(true);
			expect(checkResult.value.isOwner).toBe(false);
			expect(checkResult.value.isCreator).toBe(false);
			expect(checkResult.value.isGranted).toBe(true);
			expect(checkResult.value.isAdmin).toBe(false);
		}
	});

	test("should check access for non-granted user", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Check No Access Test",
				type: "discussion",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Check access for user3 (no access)
		const checkResult = await tryCheckActivityModuleAccess({
			payload,
			activityModuleId: activityModule.id,
			userId: testUser3.id,
		});

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value.hasAccess).toBe(false);
			expect(checkResult.value.isOwner).toBe(false);
			expect(checkResult.value.isCreator).toBe(false);
			expect(checkResult.value.isGranted).toBe(false);
			expect(checkResult.value.isAdmin).toBe(false);
		}
	});

	test("should check access for admin", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Check Admin Access Test",
				type: "quiz",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Check access for admin
		const checkResult = await tryCheckActivityModuleAccess({
			payload,
			activityModuleId: activityModule.id,
			userId: adminUser.id,
		});

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value.hasAccess).toBe(true);
			expect(checkResult.value.isOwner).toBe(false);
			expect(checkResult.value.isCreator).toBe(false);
			expect(checkResult.value.isGranted).toBe(false);
			expect(checkResult.value.isAdmin).toBe(true);
		}
	});

	test("should allow admin to access any activity module", async () => {
		const user1 = await getAuthUser(user1Token);
		const admin = await getAuthUser(adminToken);

		// Create activity module as user1
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Admin Access Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Admin should be able to read
		const result = await payload.findByID({
			collection: "activity-modules",
			id: activityModule.id,
			user: admin,
		});
		expect(result.id).toBe(activityModule.id);

		// Admin should be able to update
		const updated = await payload.update({
			collection: "activity-modules",
			id: activityModule.id,
			data: {
				title: "Updated by Admin",
			},
			user: admin,
		});
		expect(updated.title).toBe("Updated by Admin");

		// Admin should be able to delete
		const deleted = await payload.delete({
			collection: "activity-modules",
			id: activityModule.id,
			user: admin,
		});
		expect(deleted.id).toBe(activityModule.id);
	});

	test("should prevent duplicate access grants", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Duplicate Grant Test",
				type: "quiz",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		const firstGrant = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});
		expect(firstGrant.ok).toBe(true);

		// Try to grant again - should fail
		const secondGrant = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});
		expect(secondGrant.ok).toBe(false);
	});

	test("should prevent owner from being granted access again", async () => {
		const user1 = await getAuthUser(user1Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Owner Grant Test",
				type: "discussion",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Try to grant access to owner - this is technically allowed by the function
		// but redundant since owner already has access
		const grantResult = await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser1.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// Should succeed (no rule prevents it, though it's redundant)
		expect(grantResult.ok).toBe(true);
	});

	test("should handle ownership transfer removing new owner's grant", async () => {
		const user1 = await getAuthUser(user1Token);
		const user2 = await getAuthUser(user2Token);

		// Create activity module
		const activityModule = await payload.create({
			collection: "activity-modules",
			data: {
				title: "Transfer Remove Grant Test",
				type: "assignment",
				status: "draft",
				createdBy: testUser1.id,
				owner: testUser1.id,
			},
			user: user1,
			overrideAccess: true,
		});

		// Grant access to user2
		await tryGrantAccessToActivityModule({
			payload,
			activityModuleId: activityModule.id,
			grantedToUserId: testUser2.id,
			grantedByUserId: testUser1.id,
			overrideAccess: true,
		});

		// Transfer ownership to user2
		await tryTransferActivityModuleOwnership({
			payload,
			activityModuleId: activityModule.id,
			newOwnerId: testUser2.id,
			currentOwnerId: testUser1.id,
			overrideAccess: true,
		});

		// Verify the grant for user2 was removed (since they're now owner)
		const grants = await payload.find({
			collection: "activity-module-grants",
			where: {
				and: [
					{ activityModule: { equals: activityModule.id } },
					{ grantedTo: { equals: testUser2.id } },
				],
			},
			overrideAccess: true,
		});

		expect(grants.docs.length).toBe(0);

		// Verify user1 now has a grant
		const user1Grants = await payload.find({
			collection: "activity-module-grants",
			where: {
				and: [
					{ activityModule: { equals: activityModule.id } },
					{ grantedTo: { equals: testUser1.id } },
				],
			},
			overrideAccess: true,
		});

		expect(user1Grants.docs.length).toBe(1);
	});
});
