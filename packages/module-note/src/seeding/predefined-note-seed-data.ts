import { devConstants } from "../utils/constants";
import type { NoteSeedData } from "./note-seed-schema";

/**
 * Predefined note seed data for tests.
 * References users from predefined-user-seed-data (admin, user@example.com).
 */
export const predefinedNoteSeedData: NoteSeedData = {
	notes: [
		{
			content: "# Admin's First Note\n\nThis is a sample note from the admin user.",
			userEmail: devConstants.ADMIN_EMAIL,
			isPublic: true,
		},
		{
			content: "# Regular User Note\n\nA private note from the regular user.",
			userEmail: "user@example.com",
			isPublic: false,
		},
		{
			content: "Quick thought: Learning is a journey, not a destination.",
			userEmail: "user@example.com",
			isPublic: true,
		},
	],
};
