import {
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
import { Link, redirect } from "react-router";
import { typeCreateActionRpc } from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { devConstants, setAuthCookie } from "@paideia/core";
import { z } from "zod";
import {
	badRequest,
	InternalServerErrorResponse,
} from "app/utils/router/responses";
import type { Route } from "./+types/login";
import { getRouteUrl } from "app/utils/router/search-params-utils";

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { paideia, requestContext } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (userSession?.isAuthenticated) {
		return redirect(
			getRouteUrl("/", {
				searchParams: {},
			}),
		);
	}

	const [userCount, settingsResult] = await Promise.all([
		paideia
			.tryGetUserCount({
				overrideAccess: true,
				req: requestContext,
			})
			.getOrElse(() => {
				throw new InternalServerErrorResponse("Failed to get user count");
			}),
		paideia
			.tryGetRegistrationSettings({
				overrideAccess: true,
				req: requestContext,
			})
			.getOrElse(() => {
				throw new InternalServerErrorResponse(
					"Failed to get registration settings",
				);
			}),
	]);

	if (userCount === 0) {
		return redirect(getRouteUrl("/registration", {}));
	}

	const registrationDisabled = settingsResult.disableRegistration;

	return {
		user: null,
		message: "Welcome to login page",
		NODE_ENV: process.env.NODE_ENV,
		DEV_CONSTANTS: devConstants,
		registrationDisabled,
	};
});

const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(6),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/login",
});

const loginRpc = createActionRpc({
	formDataSchema: loginSchema,
	method: "POST",
});

const loginAction = loginRpc.createAction(
	async ({ context, formData, request }) => {
		const { paideia, requestInfo, requestContext } =
			context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		if (userSession?.isAuthenticated) {
			return redirect(getRouteUrl("/", { searchParams: {} }));
		}

		const loginResult = await paideia.tryLogin({
			email: formData.email,
			password: formData.password,
			req: requestContext,
		});

		if (!loginResult.ok) {
			return badRequest({
				success: false,
				error: "Invalid credentials",
			});
		}

		const { token, exp } = loginResult.value;

		return redirect(getRouteUrl("/", { searchParams: {} }), {
			headers: {
				"Set-Cookie": setAuthCookie(token, exp, {
					cookiePrefix: paideia.getCookiePrefix(),
					domainUrl: requestInfo.domainUrl,
					headers: request.headers,
				}),
			},
		});
	},
);

const useLogin = loginRpc.createHook<typeof loginAction>();

// Export hook for use in component
export { useLogin };

export const action = loginAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "Login successful",
			message: "You are now logged in",
		});
	} else if ("error" in actionData) {
		notifications.show({
			title: "Login failed",
			message: actionData?.error,
		});
	}
	return actionData;
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
	const { message, NODE_ENV, DEV_CONSTANTS, registrationDisabled } = loaderData;
	const { submit: login, isLoading } = useLogin();
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			email: "",
			password: "",
		},
		validate: {
			email: isEmail("Invalid email"),
			password: (value) =>
				value.length < 6 ? "Password must be at least 6 characters" : null,
		},
	});

	const handleAutoFill = () => {
		form.setValues({
			email: DEV_CONSTANTS.ADMIN_EMAIL,
			password: DEV_CONSTANTS.ADMIN_PASSWORD,
		});
	};

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
			<title>Login | Paideia LMS</title>
			<meta
				name="description"
				content="Log in to Paideia Learning Management System"
			/>
			<meta property="og:title" content="Login | Paideia LMS" />
			<meta
				property="og:description"
				content="Log in to Paideia Learning Management System"
			/>

			<Paper
				withBorder
				shadow="md"
				p="lg"
				radius="md"
				style={{ width: 400, margin: "0 auto" }}
			>
				<Title order={1} ta="center" mb="md">
					Login
				</Title>
				<Text ta="center" mb="lg">
					{message}
				</Text>

				{NODE_ENV === "development" && (
					<Button
						onClick={handleAutoFill}
						variant="light"
						color="gray"
						fullWidth
						mb="md"
						size="sm"
					>
						🚀 Auto-fill (Dev Only)
					</Button>
				)}

				<form
					onSubmit={form.onSubmit(async (values) => {
						await login({
							values: {
								email: values.email,
								password: values.password,
							},
						});
					})}
				>
					<TextInput
						{...form.getInputProps("email")}
						key={form.key("email")}
						label="Email"
						placeholder="Enter your email"
						type="email"
						required
						mb="md"
					/>

					<PasswordInput
						{...form.getInputProps("password")}
						key={form.key("password")}
						label="Password"
						placeholder="Enter your password"
						required
						mb="lg"
					/>

					<Stack gap="sm">
						<Button type="submit" fullWidth size="lg" loading={isLoading}>
							Login
						</Button>
						{!registrationDisabled && (
							<Text ta="center" c="dimmed" size="sm">
								<Anchor
									component={Link}
									to={getRouteUrl("/registration", {})}
									underline="always"
								>
									Create an account
								</Anchor>
							</Text>
						)}
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
