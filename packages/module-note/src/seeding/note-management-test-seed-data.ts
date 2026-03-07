import type { UserModule } from "@paideia/module-user";
import { devConstants } from "../utils/constants";

type UserSeedData = UserModule.UserSeedData;
type MediaSeedData = UserModule.MediaSeedData;

/**
 * Seed data for note-management.test.ts.
 * Provides users (admin, testuser1, testuser2, nouser) and media (test-note-media.png).
 */
export const noteManagementTestUserSeedData: UserSeedData = {
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
			email: "nouser@example.com",
			password: "testpassword123",
			firstName: "No",
			lastName: "Notes",
			role: "student",
			generateApiKey: false,
			login: false,
		},
	],
};

export const noteManagementTestMediaSeedData: MediaSeedData = {
	media: [
		{
			filename: "test-note-media.png",
			mimeType: "image/png",
			alt: "Test note media",
			caption: "Media for note management tests",
			userEmail: "testuser1@example.com",
			filePath: "src/fixture/gem.png",
		},
	],
};
