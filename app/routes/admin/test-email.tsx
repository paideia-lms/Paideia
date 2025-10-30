import {
	Alert,
	Button,
	Container,
	Paper,
	Radio,
	Stack,
	Text,
	TextInput,
	Textarea,
	Title,
} from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconInfoCircle, IconMail } from "@tabler/icons-react";
import { useFetcher } from "react-router";
import { z } from "zod";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { trySendEmail } from "server/internal/email";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/test-email";

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
	const emailConfigured =
		!!envVars.SMTP_HOST.value &&
		!!envVars.SMTP_USER.value &&
		!!envVars.SMTP_PASS.value;

	// if (!emailConfigured) {
	// 	throw new NotFoundResponse(
	// 		"Email is not configured. Please configure SMTP settings in environment variables.",
	// 	);
	// }

	return {
		smtpHost: envVars.SMTP_HOST.value || "",
		smtpUser: envVars.SMTP_USER.value || "",
		fromAddress: "info@paideialms.com", // Default from payload config
		emailConfigured,
	};
};

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

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload, platformInfo } = context.get(globalContextKey);
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

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = actionSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.message || "Invalid form data",
		});
	}

	let subject: string;
	let body: string;

	if (parsed.data.messageType === "predefined") {
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
		subject = parsed.data.subject;
		body = `
			<html>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
					${parsed.data.body.replace(/\n/g, "<br>")}
				</body>
			</html>
		`;
	}

	const result = await trySendEmail({
		payload,
		to: parsed.data.recipient,
		subject,
		html: body,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id?.toString() || null,
		},
		overrideAccess: false,
	});

	if (!result.ok) {
		return badRequest({
			success: false,
			error: result.error.message,
		});
	}

	return ok({
		success: true,
		message: `Test email sent successfully to ${parsed.data.recipient}`,
	});
};

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

// Custom hook for sending test email
export function useSendTestEmail() {
	const fetcher = useFetcher<typeof clientAction>();

	const sendTestEmail = (data: {
		messageType: "predefined" | "custom";
		recipient: string;
		subject?: string;
		body?: string;
	}) => {
		fetcher.submit(data, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		sendTestEmail,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export default function TestEmailPage({ loaderData }: Route.ComponentProps) {
	const { smtpHost, smtpUser, fromAddress, emailConfigured } = loaderData;
	const { sendTestEmail, isLoading } = useSendTestEmail();

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

	const handleSubmit = (values: typeof form.values) => {
		// If email is not configured, show confirmation modal
		if (!emailConfigured) {
			modals.openConfirmModal({
				title: "Email Not Configured",
				children: (
					<Stack gap="sm">
						<Text size="sm">
							Email is not currently configured on this system. The test email will fail to send.
						</Text>
						<Text size="sm" fw={500}>
							Do you want to proceed anyway?
						</Text>
						<Alert color="orange" icon={<IconAlertTriangle size={16} />}>
							<Text size="xs">
								To configure email, set the following environment variables: SMTP_HOST, SMTP_USER, and SMTP_PASS
							</Text>
						</Alert>
					</Stack>
				),
				labels: { confirm: "Proceed Anyway", cancel: "Cancel" },
				confirmProps: { color: "orange" },
				onConfirm: () => {
					sendTestEmail({
						messageType: values.messageType as "predefined" | "custom",
						recipient: values.recipient,
						subject: values.subject || undefined,
						body: values.body || undefined,
					});
				},
			});
			return;
		}

		// Email is configured, send directly
		sendTestEmail({
			messageType: values.messageType as "predefined" | "custom",
			recipient: values.recipient,
			subject: values.subject || undefined,
			body: values.body || undefined,
		});
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
							Email is not currently configured on this system. Any test emails will fail to send.
							To configure email, set the following environment variables: <strong>SMTP_HOST</strong>, <strong>SMTP_USER</strong>, and <strong>SMTP_PASS</strong>.
						</Text>
					</Alert>
				)}

				{/* SMTP Configuration Info */}
				<Alert
					icon={<IconInfoCircle size={20} />}
					title="Current Email Configuration"
					color={emailConfigured ? "blue" : "gray"}
				>
					<Stack gap="xs">
						<Text size="sm">
							<strong>SMTP Host:</strong> {smtpHost || "(not set)"}
						</Text>
						<Text size="sm">
							<strong>SMTP User:</strong> {smtpUser || "(not set)"}
						</Text>
						<Text size="sm">
							<strong>From Address:</strong> {fromAddress}
						</Text>
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
						<strong>Note:</strong> If you receive the test email, your SMTP
						configuration is working correctly. If not, please check your
						environment variables and SMTP server settings.
					</Text>
				</Alert>
			</Stack>
		</Container>
	);
}

