import {
	Alert,
	Button,
	Container,
	Paper,
	Radio,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
	IconAlertTriangle,
	IconInfoCircle,
	IconMail,
} from "@tabler/icons-react";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { trySendEmail } from "server/internal/email";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/test-email";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const predefinedSchema = z.object({
	messageType: z.literal("predefined"),
	recipient: z.email("Invalid email address"),
});

const customSchema = z.object({
	messageType: z.literal("custom"),
	recipient: z.email("Invalid email address"),
	subject: z.string().min(1, "Subject is required"),
	body: z.string().min(1, "Body is required"),
});

const actionSchema = z.discriminatedUnion("messageType", [
	predefinedSchema,
	customSchema,
]);

const createSendTestEmailActionRpc = createActionRpc({
	formDataSchema: actionSchema,
	method: "POST",
});

export function getRouteUrl() {
	return href("/admin/test-email");
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { envVars } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("You must be logged in");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this page");
	}

	// Check if email is configured
	const resendConfigured = !!envVars.RESEND_API_KEY.value;
	const smtpConfigured =
		!!envVars.SMTP_HOST.value &&
		!!envVars.SMTP_USER.value &&
		!!envVars.SMTP_PASS.value;
	const emailConfigured = resendConfigured || smtpConfigured;

	// if (!emailConfigured) {
	// 	throw new NotFoundResponse(
	// 		"Email is not configured. Please configure SMTP settings in environment variables.",
	// 	);
	// }

	return {
		emailProvider: resendConfigured ? "resend" : smtpConfigured ? "smtp" : null,
		resendApiKeySet: resendConfigured,
		fromAddress:
			envVars.EMAIL_FROM_ADDRESS.value ??
			envVars.EMAIL_FROM_ADDRESS.default ??
			"",
		fromName:
			envVars.EMAIL_FROM_NAME.value ?? envVars.EMAIL_FROM_NAME.default ?? "",
		smtpHost: envVars.SMTP_HOST.value || "",
		smtpUser: envVars.SMTP_USER.value || "",
		emailConfigured,
	};
};

const [sendTestEmailAction, useSendTestEmail] = createSendTestEmailActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, platformInfo, payloadRequest } =
			context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in",
			});
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (currentUser.role !== "admin") {
			return badRequest({
				success: false,
				error: "Only admins can send test emails",
			});
		}

		let subject: string;
		let body: string;

		if (formData.messageType === "predefined") {
			const now = new Date().toISOString();
			subject = "Test email from Paideia LMS";
			body = `
			<html>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
					<h2 style="color: #2c5282;">Test Email from Paideia LMS</h2>
					<p>This is a test email to verify your email configuration.</p>
					<hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
					<h3 style="color: #4a5568;">System Information</h3>
					<ul style="list-style: none; padding: 0;">
						<li><strong>Server Time:</strong> ${now}</li>
						<li><strong>Platform:</strong> ${platformInfo.platform}</li>
						<li><strong>Environment:</strong> ${process.env.NODE_ENV || "unknown"}</li>
						<li><strong>Sent By:</strong> ${currentUser.email}</li>
					</ul>
					<hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
					<p style="color: #718096; font-size: 14px;">
						If you received this email, your SMTP configuration is working correctly.
					</p>
				</body>
			</html>
		`;
		} else {
			subject = formData.subject;
			body = `
			<html>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
					${formData.body.replace(/\n/g, "<br>")}
				</body>
			</html>
		`;
		}

		const result = await trySendEmail({
			payload,
			to: formData.recipient,
			subject,
			html: body,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: `Test email sent successfully to ${formData.recipient}`,
		});
	})!,
	{
		action: getRouteUrl,
	},
);

// Export hook for use in components
export { useSendTestEmail };

export const action = sendTestEmailAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData?.message || "Email sent successfully",
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData?.error || "Failed to send email",
			color: "red",
		});
	}
	return actionData;
}

export default function TestEmailPage({ loaderData }: Route.ComponentProps) {
	const {
		emailProvider,
		resendApiKeySet,
		fromAddress,
		fromName,
		smtpHost,
		smtpUser,
		emailConfigured,
	} = loaderData;
	const { submit: sendTestEmail, isLoading } = useSendTestEmail();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			messageType: "predefined",
			recipient: "",
			subject: "",
			body: "",
		},
		validate: {
			recipient: isEmail("Invalid email address"),
			subject: (value, values) =>
				values.messageType === "custom" && !value
					? "Subject is required"
					: null,
			body: (value, values) =>
				values.messageType === "custom" && !value ? "Body is required" : null,
		},
	});

	const handleSubmit = async (values: typeof form.values) => {
		async function sendMail() {
			await sendTestEmail({
				values:
					values.messageType === "custom"
						? {
								messageType: "custom",
								recipient: values.recipient,
								subject: values.subject,
								body: values.body,
							}
						: {
								messageType: "predefined",
								recipient: values.recipient,
							},
			});
		}
		// If email is not configured, show confirmation modal
		if (!emailConfigured) {
			modals.openConfirmModal({
				title: "Email Not Configured",
				children: (
					<Stack gap="sm">
						<Text size="sm">
							Email is not currently configured on this system. The test email
							will fail to send.
						</Text>
						<Text size="sm" fw={500}>
							Do you want to proceed anyway?
						</Text>
						<Alert color="orange" icon={<IconAlertTriangle size={16} />}>
							<Text size="xs">
								To configure email, either set RESEND_API_KEY (for Resend) or
								SMTP_HOST, SMTP_USER, and SMTP_PASS (for SMTP). Optionally set
								EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME for both providers.
							</Text>
						</Alert>
					</Stack>
				),
				labels: { confirm: "Proceed Anyway", cancel: "Cancel" },
				confirmProps: { color: "orange" },
				onConfirm: sendMail,
			});
			return;
		}

		// Email is configured, send directly
		await sendMail();
	};

	const messageType = form.getValues().messageType;

	const title = "Email Configuration Test | Admin | Paideia LMS";

	return (
		<Container size="md" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content="Test email configuration in Paideia LMS"
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content="Test email configuration in Paideia LMS"
			/>

			<Stack gap="xl">
				<div>
					<Title order={2}>Email Configuration Test</Title>
					<Text c="dimmed" mt="xs">
						Verify the email settings for this Paideia LMS site by sending a
						test email message to the address you specify.
					</Text>
				</div>

				{/* Warning when email is not configured */}
				{!emailConfigured && (
					<Alert
						icon={<IconAlertTriangle size={20} />}
						title="Email Not Configured"
						color="orange"
					>
						<Text size="sm">
							Email is not currently configured on this system. Any test emails
							will fail to send. To configure email, either:
						</Text>
						<Stack gap="xs" mt="xs">
							<Text size="sm">
								<strong>Option 1 (Resend):</strong> Set{" "}
								<strong>RESEND_API_KEY</strong> environment variable (optionally{" "}
								<strong>EMAIL_FROM_ADDRESS</strong> and{" "}
								<strong>EMAIL_FROM_NAME</strong>).
							</Text>
							<Text size="sm">
								<strong>Option 2 (SMTP):</strong> Set <strong>SMTP_HOST</strong>
								, <strong>SMTP_USER</strong>, and <strong>SMTP_PASS</strong>{" "}
								environment variables (optionally{" "}
								<strong>EMAIL_FROM_ADDRESS</strong> and{" "}
								<strong>EMAIL_FROM_NAME</strong>).
							</Text>
						</Stack>
					</Alert>
				)}

				{/* Email Configuration Info */}
				<Alert
					icon={<IconInfoCircle size={20} />}
					title="Current Email Configuration"
					color={emailConfigured ? "blue" : "gray"}
				>
					<Stack gap="xs">
						<Text size="sm">
							<strong>Provider:</strong>{" "}
							{emailProvider === "resend"
								? "Resend"
								: emailProvider === "smtp"
									? "SMTP (Nodemailer)"
									: "Not configured"}
						</Text>
						{emailProvider === "resend" && (
							<>
								<Text size="sm">
									<strong>Resend API Key:</strong>{" "}
									{resendApiKeySet ? "✓ Set (hidden)" : "(not set)"}
								</Text>
								<Text size="sm">
									<strong>From Address:</strong> {fromAddress || "(default)"}
								</Text>
								<Text size="sm">
									<strong>From Name:</strong> {fromName || "(default)"}
								</Text>
							</>
						)}
						{emailProvider === "smtp" && (
							<>
								<Text size="sm">
									<strong>SMTP Host:</strong> {smtpHost || "(not set)"}
								</Text>
								<Text size="sm">
									<strong>SMTP User:</strong> {smtpUser || "(not set)"}
								</Text>
								<Text size="sm">
									<strong>From Address:</strong> {fromAddress || "(default)"}
								</Text>
								<Text size="sm">
									<strong>From Name:</strong> {fromName || "(default)"}
								</Text>
							</>
						)}
						{!emailProvider && (
							<>
								<Text size="sm">
									<strong>From Address:</strong>{" "}
									{fromAddress || "(default, not configured)"}
								</Text>
								<Text size="sm">
									<strong>From Name:</strong>{" "}
									{fromName || "(default, not configured)"}
								</Text>
							</>
						)}
					</Stack>
				</Alert>

				{/* Test Email Form */}
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<form onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="md">
							<Radio.Group
								label="Message Type"
								description="Choose between a predefined test message or a custom message"
								key={form.key("messageType")}
								{...form.getInputProps("messageType")}
							>
								<Stack mt="xs" gap="xs">
									<Radio
										value="predefined"
										label="Predefined test message with system information"
									/>
									<Radio value="custom" label="Custom message" />
								</Stack>
							</Radio.Group>

							<TextInput
								label="Recipient Email Address"
								placeholder="user@example.com"
								description="Enter the email address where you want to send the test email"
								required
								leftSection={<IconMail size={16} />}
								key={form.key("recipient")}
								{...form.getInputProps("recipient")}
							/>

							{messageType === "custom" && (
								<>
									<TextInput
										label="Subject"
										placeholder="Test Email Subject"
										description="Enter the subject for your test email"
										required
										key={form.key("subject")}
										{...form.getInputProps("subject")}
									/>

									<Textarea
										label="Message Body"
										placeholder="Enter your custom message here..."
										description="Enter the body content for your test email"
										required
										minRows={6}
										key={form.key("body")}
										{...form.getInputProps("body")}
									/>
								</>
							)}

							<Button
								type="submit"
								loading={isLoading}
								leftSection={<IconMail size={18} />}
								fullWidth
								mt="md"
							>
								Send Test Email
							</Button>
						</Stack>
					</form>
				</Paper>

				<Alert color="gray" icon={<IconInfoCircle size={20} />}>
					<Text size="sm">
						<strong>Note:</strong> If you receive the test email, your email
						configuration is working correctly. If not, please check your
						environment variables and email provider settings (Resend API key or
						SMTP credentials).
					</Text>
				</Alert>
			</Stack>
		</Container>
	);
}
