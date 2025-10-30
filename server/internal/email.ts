import type { BasePayload } from "payload";
import { Result } from "typescript-result";
import { EmailSendError } from "~/utils/error";
import type { User } from "../payload-types";

export type TrySendEmailArgs = {
	payload: BasePayload;
	to: string;
	subject: string;
	html: string;
	user: Omit<User, "avatar"> & { avatar?: string | null };
	overrideAccess: boolean;
};

/**
 * Send an email using Payload's email adapter
 * @returns Result with void on success, EmailSendError on failure
 */
export const trySendEmail = Result.wrap(
	async ({
		payload,
		to,
		subject,
		html,
		user,
		overrideAccess,
	}: TrySendEmailArgs): Promise<void> => {
		if (!to || to.trim() === "") {
			throw new Error("Recipient email is required");
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(to)) {
			throw new Error("Invalid email format");
		}

		if (!payload.email) {
			throw new Error("Email adapter is not configured");
		}

		// Send the email using Payload's email adapter
		await payload.sendEmail({
			to,
			subject,
			html,
			overrideAccess,
			user,
		});
	},
	(error) => {
		const message =
			error instanceof Error ? error.message : "Failed to send email";
		return new EmailSendError(message, { cause: error });
	},
);

