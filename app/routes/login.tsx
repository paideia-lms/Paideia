import { Anchor, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { type ActionFunctionArgs, href, type LoaderFunctionArgs, redirect, useFetcher, Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryLogin } from "server/internal/user-management";
import { tryGetRegistrationSettings } from "server/internal/registration-settings";
import { devConstants } from "server/utils/constants";
import { z } from "zod";
import { setCookie } from "~/utils/cookie";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/login";

export const loader = async ({ context }: LoaderFunctionArgs) => {
	// Mock loader - just return some basic data
	const userSession = context.get(userContextKey);

	if (userSession?.isAuthenticated) {
		throw redirect(href("/"));
	}

	const { payload } = context.get(globalContextKey);

	const firstUser = await payload.find({
		collection: "users",
		limit: 1,
	});

	if (firstUser.docs.length === 0) {
		throw redirect(href("/registration"));
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

	return {
		user: null,
		message: "Welcome to login page",
		NODE_ENV: process.env.NODE_ENV,
		DEV_CONSTANTS: devConstants,
		registrationDisabled,
	};
};

const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(6),
});

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const requestInfo = context.get(globalContextKey).requestInfo;
	const userSession = context.get(userContextKey);
	if (userSession?.isAuthenticated) {
		throw redirect(href("/"));
	}

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsedData = loginSchema.parse(data);

	const loginResult = await tryLogin({
		payload,
		email: parsedData.email,
		password: parsedData.password,
		req: request,
	});

	if (!loginResult.ok) {
		return badRequest({
			success: false,
			error: "Invalid credentials",
		});
	}

	const { token, exp } = loginResult.value;

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
};

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
	const fetcher = useFetcher<typeof action>();
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

				<fetcher.Form
					method="POST"
					onSubmit={form.onSubmit((values) => {
						fetcher.submit(values, {
							method: "POST",
							encType: "application/json",
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
						<Button type="submit" fullWidth size="lg">
							Login
						</Button>
						{!registrationDisabled && (
							<Text ta="center" c="dimmed" size="sm">
								<Anchor component={Link} to={href("/registration")} underline="always">
									Create an account
								</Anchor>
							</Text>
						)}
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
