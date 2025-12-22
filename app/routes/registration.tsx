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
import { href, Link, redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetRegistrationSettings } from "server/internal/registration-settings";
import {
	tryGetUserCount,
	tryRegisterFirstUser,
	tryRegisterUser,
} from "server/internal/user-management";
import { devConstants } from "server/utils/constants";
import { z } from "zod";
import { setCookie } from "~/utils/cookie";
import {
	badRequest,
	ForbiddenResponse,
	InternalServerErrorResponse,
} from "~/utils/responses";
import type { Route } from "./+types/registration";

export async function loader({ context }: Route.LoaderArgs) {
	const { payload, envVars } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	const userCount = await tryGetUserCount({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
	}).getOrElse(() => {
		throw new InternalServerErrorResponse("Failed to get user count");
	});

	const isFirstUser = userCount === 0;
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;

	// Respect registration settings unless creating the first user

	// if user already login, redirect to dashboard
	if (userSession?.isAuthenticated) {
		return redirect(href("/"));
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

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createRegisterActionRpc = createActionRpc({
	formDataSchema: z.object({
		email: z.email(),
		password: z.string().min(8),
		firstName: z.string().min(1),
		lastName: z.string().min(1),
	}),
	method: "POST",
});

const getRouteUrl = () => {
	return href("/registration");
};

const [registerAction, useRegister] = createRegisterActionRpc(
	serverOnly$(async ({ context, formData, request }) => {
		const { payload, requestInfo, envVars } = context.get(globalContextKey);

		// Determine if first user
		const userCountResult = await tryGetUserCount({
			payload,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});
		if (!userCountResult.ok) {
			return badRequest({
				success: false,
				error: userCountResult.error.message,
			});
		}
		const userCount = userCountResult.value;
		const isFirstUser = userCount === 0;
		const isSandboxMode = envVars.SANDBOX_MODE.enabled;

		// Respect registration settings unless creating the first user
		const settingsResult = await tryGetRegistrationSettings({
			payload,
			// ! this has override access because it is a system request, we don't care about access control
			overrideAccess: true,
		});
		if (
			settingsResult.ok &&
			settingsResult.value.disableRegistration &&
			!isFirstUser
		) {
			return badRequest({
				success: false,
				error: "Registration is disabled",
			});
		}

		// For first user, register as admin; otherwise regular registration
		if (isFirstUser) {
			const result = await tryRegisterFirstUser({
				payload,
				email: formData.email,
				password: formData.password,
				firstName: formData.firstName,
				lastName: formData.lastName,
				// ! this is a system request, we don't care about access control
				overrideAccess: true,
			});

			if (!result.ok) {
				return badRequest({ success: false, error: result.error.message });
			}

			const { token, exp } = result.value;
			return redirect(href("/"), {
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
			email: formData.email,
			password: formData.password,
			firstName: formData.firstName,
			lastName: formData.lastName,
			role: registrationRole,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		if (!result.ok) {
			return badRequest({ success: false, error: result.error.message });
		}

		const { token, exp } = result.value;
		return redirect(href("/"), {
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
	})!,
	{
		action: getRouteUrl,
	},
);

// Export hook for use in component
export { useRegister };

export const action = registerAction;

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
	const { submit: register, isLoading } = useRegister();

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
		<form
			onSubmit={form.onSubmit(async (values) => {
				await register({
					values: {
						email: values.email,
						password: values.password,
						firstName: values.firstName,
						lastName: values.lastName,
					},
				});
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

			<Button type="submit" loading={isLoading} style={{ marginTop: "16px" }}>
				Create Account
			</Button>
		</form>
	);
}
