import { devConstants } from "../../../utils/constants";
import type { MediaSeedData } from "../../user/seeding/media-seed-schema";
import type { UserSeedData } from "../../user/seeding/user-seed-schema";

/**
 * Seed data for page-management.test.ts.
 * Provides users (admin, testuser1, testuser2, nopages) and media (test-page-media.png).
 */
export const pageManagementTestUserSeedData: UserSeedData = {
	users: [
		{
			email: devConstants.ADMIN_EMAIL,
			password: devConstants.ADMIN_PASSWORD,
			firstName: "Admin",
			lastName: "User",
			role: "admin",
			generateApiKey: false,
			login: true,
		},
		{
			email: "testuser1@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User1",
			role: "student",
			generateApiKey: false,
			login: true,
		},
		{
			email: "testuser2@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User2",
			role: "student",
			generateApiKey: false,
			login: true,
		},
		{
			email: "nopages@example.com",
			password: "testpassword123",
			firstName: "No",
			lastName: "Pages",
			role: "student",
			generateApiKey: false,
			login: false,
		},
	],
};

export const pageManagementTestMediaSeedData: MediaSeedData = {
	media: [
		{
			filename: "test-page-media.png",
			mimeType: "image/png",
			alt: "Test page media",
			caption: "Media for page management tests",
			userEmail: "testuser1@example.com",
			filePath: "src/modules/note/fixture/gem.png",
		},
	],
};

