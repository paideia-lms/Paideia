import type { UserModule } from "@paideia/module-user";
import { devConstants } from "../utils/constants";

type UserSeedData = UserModule.UserSeedData;

export const enrollmentManagementTestUserSeedData: UserSeedData = {
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
			email: "contentmanager@example.com",
			password: "testpassword123",
			firstName: "Content",
			lastName: "Manager",
			role: "student",
			generateApiKey: false,
			login: true,
		},
		{
			email: "instructor@example.com",
			password: "testpassword123",
			firstName: "Instructor",
			lastName: "User",
			role: "student",
			generateApiKey: false,
			login: true,
		},
	],
};
