import type { UserModule } from "@paideia/module-user";
import { devConstants } from "../utils/constants";

type UserSeedData = UserModule.UserSeedData;
type MediaSeedData = UserModule.MediaSeedData;

/**
 * Seed data for whiteboard-management.test.ts.
 * Provides users (admin, testuser1, testuser2, nowhiteboards) and media (test-whiteboard-media.png).
 */
export const whiteboardManagementTestUserSeedData: UserSeedData = {
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
			email: "nowhiteboards@example.com",
			password: "testpassword123",
			firstName: "No",
			lastName: "Whiteboards",
			role: "student",
			generateApiKey: false,
			login: false,
		},
	],
};

export const whiteboardManagementTestMediaSeedData: MediaSeedData = {
	media: [
		{
			filename: "test-whiteboard-media.png",
			mimeType: "image/png",
			alt: "Test whiteboard media",
			caption: "Media for whiteboard management tests",
			userEmail: "testuser1@example.com",
			filePath: "src/fixture/gem.png",
		},
	],
};
