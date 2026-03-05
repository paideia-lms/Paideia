import { devConstants } from "../../../utils/constants";
import type { UserSeedData } from "./user-seed-schema";

/**
 * Predefined user seed data for tests.
 * Aligns with devConstants for admin credentials.
 */
export const predefinedUserSeedData: UserSeedData = {
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
			email: "user@example.com",
			password: "userpassword123",
			firstName: "Regular",
			lastName: "User",
			role: "student",
			generateApiKey: false,
			login: true,
		},
		{
			email: "apikey-user-seed@example.com",
			password: "apikeypassword123",
			firstName: "API",
			lastName: "KeyUser",
			role: "student",
			generateApiKey: true,
			login: false,
		},
	],
};
