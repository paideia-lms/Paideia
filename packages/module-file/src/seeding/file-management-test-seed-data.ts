import type { UserModule } from "@paideia/module-user";
import { devConstants } from "../utils/constants";

type UserSeedData = UserModule.UserSeedData;
type MediaSeedData = UserModule.MediaSeedData;

/**
 * Seed data for file-management.test.ts.
 * Provides users (admin, testuser1, testuser2, nofiles) and media for attachment tests.
 */
export const fileManagementTestUserSeedData: UserSeedData = {
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
			email: "nofiles@example.com",
			password: "testpassword123",
			firstName: "No",
			lastName: "Files",
			role: "student",
			generateApiKey: false,
			login: false,
		},
	],
};

export const fileManagementTestMediaSeedData: MediaSeedData = {
	media: [
		{
			filename: "test-file-attachment-1.png",
			mimeType: "image/png",
			alt: "Test file attachment 1",
			caption: "First attachment for file management tests",
			userEmail: "testuser1@example.com",
			filePath: "src/fixture/gem.png",
		},
		{
			filename: "test-file-attachment-2.png",
			mimeType: "image/png",
			alt: "Test file attachment 2",
			caption: "Second attachment for file management tests",
			userEmail: "testuser1@example.com",
			filePath: "src/fixture/gem.png",
		},
	],
};
