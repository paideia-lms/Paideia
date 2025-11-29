import { Result } from "typescript-result";
import { EmailSendError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { z } from "zod";

const emailSchema = z.email();
export interface TrySendEmailArgs extends BaseInternalFunctionArgs {
	to: string;
	subject: string;
	html: string;
}

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
		req,
		overrideAccess,
	}: TrySendEmailArgs): Promise<void> => {
		if (!to || to.trim() === "") {
			throw new Error("Recipient email is required");
		}

		// Basic email validation
		const emailResult = emailSchema.safeParse(to);
		if (!emailResult.success) {
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
			user: req?.user,
		});
	},
	(error) => {
		const message =
			error instanceof Error ? error.message : "Failed to send email";
		return new EmailSendError(message, { cause: error });
	},
);
