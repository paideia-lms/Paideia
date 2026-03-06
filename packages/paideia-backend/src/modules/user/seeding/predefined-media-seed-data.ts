import { devConstants } from "../../../utils/constants";
import type { MediaSeedData } from "./media-seed-schema";
import Gem from "../fixture/gem.png" with { type: "file" };
import PaideiaLogo from "../fixture/paideia-logo.png" with { type: "file" };

/**
 * Predefined media seed data for tests.
 * References users from predefined-user-seed-data (admin, user@example.com).
 * File paths are relative to packages/paideia-backend.
 */
export const predefinedMediaSeedData: MediaSeedData = {
	media: [
		{
			filename: "gem.png",
			mimeType: "image/png",
			alt: "Gem icon",
			caption: "Sample gem image for admin",
			userEmail: devConstants.ADMIN_EMAIL,
			filePath: Gem,
		},
		{
			filename: "paideia-logo.png",
			mimeType: "image/png",
			alt: "Paideia logo",
			caption: "Paideia LMS logo",
			userEmail: "user@example.com",
			filePath: PaideiaLogo,
		},
	],
};
