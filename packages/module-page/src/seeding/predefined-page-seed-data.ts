import { devConstants } from "../utils/constants";
import type { PageSeedData } from "./page-seed-schema";

/**
 * Predefined page seed data for tests.
 * References users from predefined-user-seed-data (admin, user@example.com).
 */
export const predefinedPageSeedData: PageSeedData = {
	pages: [
		{
			title: "Getting Started with Paideia",
			description: "A comprehensive guide to help you begin your learning journey",
			content: "# Getting Started\n\nWelcome to Paideia! This guide will help you get started.",
			userEmail: devConstants.ADMIN_EMAIL,
		},
		{
			title: "Study Tips for Success",
			description: "Effective study strategies and techniques",
			content:
				"# Study Tips\n\n1. Set clear goals\n2. Create a schedule\n3. Take breaks\n4. Stay organized",
			userEmail: "user@example.com",
		},
		{
			title: "Quick Reference Guide",
			description: "Essential keyboard shortcuts and commands",
			content: "## Keyboard Shortcuts\n\n- Ctrl+S: Save\n- Ctrl+Z: Undo\n- Ctrl+F: Find",
			userEmail: "user@example.com",
		},
	],
};
