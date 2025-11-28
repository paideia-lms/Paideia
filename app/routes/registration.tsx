import {
	Alert,
	Anchor,
	Button,
	Container,
	Paper,
	PasswordInput,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle } from "@tabler/icons-react";
import { href, Link, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetRegistrationSettings } from "server/internal/registration-settings";
import {
	tryRegisterFirstUser,
	tryRegisterUser,
} from "server/internal/user-management";
import { devConstants } from "server/utils/constants";
import { z } from "zod";
import { setCookie } from "~/utils/cookie";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/registration";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

export async function loader({ context }: Route.LoaderArgs) {
	const { payload, envVars } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	const users = await payload.find({
		collection: "users",
		limit: 1,
	});

	const isFirstUser = users.docs.length === 0;
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;

	// Respect registration settings unless creating the first user

	// if user already login, redirect to dashboard
	if (userSession?.isAuthenticated) {
		throw redirect(href("/"));
	}

	const settingsResult = await tryGetRegistrationSettings({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
	});

	if (!settingsResult.ok) {
		throw new ForbiddenResponse("Failed to get registration settings");
	}

	const registrationDisabled = settingsResult.value.disableRegistration;

	// console.log("registrationDisabled", registrationDisabled);

	if (registrationDisabled && !isFirstUser) {
		throw new ForbiddenResponse("Registration is disabled");
	}

	return {
		NODE_ENV: process.env.NODE_ENV,
		DEV_CONSTANTS: devConstants,
		isFirstUser,
		registrationDisabled,
		isSandboxMode,
	};
}

const formSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	firstName: z.string(),
	lastName: z.string(),
});

export async function action({ request, context }: Route.ActionArgs) {
	const { payload, requestInfo, envVars } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	// Determine if first user
	const existing = await payload.find({ collection: "users", limit: 1 });
	const isFirstUser = existing.docs.length === 0;
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsed = formSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({ success: false, error: parsed.error.message });
	}

	// Respect registration settings unless creating the first user
	const currentUser =
		userSession?.effectiveUser ?? userSession?.authenticatedUser;
	const settingsResult = await tryGetRegistrationSettings({
		payload,
		req: createLocalReq({ request, user: currentUser, context: { routerContext: context } }),
		// ! this has override access because it is a system request, we don't care about access control
		overrideAccess: true,
	});
	if (
		settingsResult.ok &&
		settingsResult.value.disableRegistration &&
		!isFirstUser
	) {
		return badRequest({ success: false, error: "Registration is disabled" });
	}

	// For first user, register as admin; otherwise regular registration
	if (isFirstUser) {
		const result = await tryRegisterFirstUser({
			payload,
			...parsed.data,
			req: request,
		});

		if (!result.ok) {
			return badRequest({ success: false, error: result.error.message });
		}

		const { token, exp } = result.value;
		throw redirect(href("/"), {
			headers: {
				"Set-Cookie": setCookie(
					token,
					exp,
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	}

	// In sandbox mode, all registrations get admin role
	const registrationRole = isSandboxMode ? "admin" : "student";

	const result = await tryRegisterUser({
		payload,
		...parsed.data,
		role: registrationRole,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ success: false, error: result.error.message });
	}

	const { token, exp } = result.value;
	throw redirect(href("/"), {
		headers: {
			"Set-Cookie": setCookie(
				token,
				exp,
				requestInfo.domainUrl,
				request.headers,
				payload,
			),
		},
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "Registration successful",
			message: "Welcome to Paideia LMS!",
			color: "green",
		});
	} else if ("error" in actionData) {
		notifications.show({
			title: "Registration failed",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function RegistrationView({ loaderData }: Route.ComponentProps) {
	const {
		NODE_ENV,
		DEV_CONSTANTS,
		isFirstUser,
		registrationDisabled,
		isSandboxMode,
	} = loaderData;

	return (
		<Container
			size="sm"
			py="xl"
			style={{
				height: "100vh",
				flex: 1,
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<title>Register | Paideia LMS</title>
			<meta name="description" content="Create your Paideia LMS account" />
			<meta property="og:title" content="Register | Paideia LMS" />
			<meta
				property="og:description"
				content="Create your Paideia LMS account"
			/>

			<Paper
				withBorder
				shadow="md"
				p="lg"
				radius="md"
				style={{ width: 400, margin: "0 auto" }}
			>
				<Stack gap="md">
					<Title order={1} ta="center">
						Register
					</Title>
					{isSandboxMode && (
						<Alert
							icon={<IconAlertTriangle size={20} />}
							title="Sandbox Mode Enabled"
							color="yellow"
							variant="light"
						>
							<Text size="sm">
								<strong>Warning:</strong> Sandbox mode is currently enabled. You
								will automatically receive admin role upon registration, and you
								can freely change your system role. This is intended for testing
								and development purposes only. Data is temporary and will be
								reset every midnight.
							</Text>
						</Alert>
					)}
					{isFirstUser && (
						<Alert color="green" title="First user">
							You are creating the first account. It will be granted admin
							access.
						</Alert>
					)}
					<RegistrationClient
						NODE_ENV={NODE_ENV}
						DEV_CONSTANTS={DEV_CONSTANTS}
					/>
					{!registrationDisabled && !isFirstUser && (
						<Text ta="center" c="dimmed" size="sm" style={{ marginTop: "4px" }}>
							<Anchor component={Link} to={href("/login")} underline="always">
								Already have an account? Login
							</Anchor>
						</Text>
					)}
				</Stack>
			</Paper>
		</Container>
	);
}

export function RegistrationClient({
	NODE_ENV,
	DEV_CONSTANTS,
}: {
	NODE_ENV: string | undefined;
	DEV_CONSTANTS: typeof devConstants;
}) {
	const fetcher = useFetcher<typeof action>();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			email: "",
			password: "",
			confirmPassword: "",
			firstName: "",
			lastName: "",
		},
		validate: {
			email: isEmail("Invalid email"),
			password: (value) =>
				value.length < 8 ? "Password must be at least 8 characters" : null,
			confirmPassword: (value, values) =>
				value !== values.password ? "Passwords do not match" : null,
			firstName: (value) => (!value ? "First name is required" : null),
			lastName: (value) => (!value ? "Last name is required" : null),
		},
	});

	const handleAutoFill = () => {
		form.setValues({
			email: DEV_CONSTANTS.ADMIN_EMAIL,
			password: DEV_CONSTANTS.ADMIN_PASSWORD,
			confirmPassword: DEV_CONSTANTS.ADMIN_PASSWORD,
			firstName: "Admin",
			lastName: "User",
		});
	};

	return (
		<fetcher.Form
			method="POST"
			onSubmit={form.onSubmit((values) => {
				fetcher.submit(values, { method: "POST", encType: "application/json" });
			})}
			style={{ display: "flex", flexDirection: "column", gap: "16px" }}
		>
			{NODE_ENV === "development" && (
				<Button
					onClick={handleAutoFill}
					variant="light"
					color="gray"
					fullWidth
					size="sm"
				>
					🚀 Auto-fill (Dev Only)
				</Button>
			)}

			<TextInput
				{...form.getInputProps("email")}
				key={form.key("email")}
				label="Email"
				placeholder="Enter your email"
				required
			/>

			<TextInput
				{...form.getInputProps("firstName")}
				key={form.key("firstName")}
				label="First Name"
				placeholder="Enter your first name"
				required
			/>

			<TextInput
				{...form.getInputProps("lastName")}
				key={form.key("lastName")}
				label="Last Name"
				placeholder="Enter your last name"
				required
			/>

			<PasswordInput
				{...form.getInputProps("password")}
				key={form.key("password")}
				label="Password"
				placeholder="Enter your password"
				required
			/>

			<PasswordInput
				{...form.getInputProps("confirmPassword")}
				key={form.key("confirmPassword")}
				label="Confirm Password"
				placeholder="Confirm your password"
				required
			/>

			<Button
				type="submit"
				loading={fetcher.state !== "idle"}
				style={{ marginTop: "16px" }}
			>
				Create Account
			</Button>
		</fetcher.Form>
	);
}
