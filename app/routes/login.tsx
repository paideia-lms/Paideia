import {
	Alert,
	Button,
	Container,
	Paper,
	PasswordInput,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import {
	type ActionFunctionArgs,
	Form,
	href,
	type LoaderFunctionArgs,
	redirect,
	useActionData,
	useFetcher,
	useLoaderData,
} from "react-router";
import { dbContextKey } from "server/contexts/global-context";
import { z } from "zod";
import { setCookie } from "~/utils/cookie";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { ok } from "~/utils/responses";
import type { Route } from "./+types/login";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	// Mock loader - just return some basic data

	const payload = context.get(dbContextKey).payload;
	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (user) {
		throw redirect(href("/admin/*", { "*": "" }));
	}

	return {
		user: null,
		message: "Welcome to login page",
	};
};

const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(6),
});

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const payload = context.get(dbContextKey).payload;
	const requestInfo = context.get(dbContextKey).requestInfo;
	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});
	console.log("action");
	console.log(responseHeaders, permissions, user);

	if (user) {
		throw redirect(href("/admin/*", { "*": "" }));
	}

	const { contentType, data } = await getDataAndContentTypeFromRequest(request);

	console.log(contentType, data);
	try {
		const parsedData = loginSchema.parse(data);

		const { exp, token, user } = await payload.login({
			collection: "users",
			req: request,
			data: parsedData,
		});

		if (!exp || !token) {
			return {
				success: false,
				error: "Invalid credentials",
			};
		}

		console.log(exp, token, user);

		// set the cookie

		return ok(
			{
				success: true,
				message: "Login successful",
			},
			{
				headers: {
					"Set-Cookie": setCookie(token, exp, requestInfo.domainUrl),
				},
			},
		);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Login failed",
		};
	}
};

export async function clientAction({
	request,
	serverAction,
}: Route.ClientActionArgs) {
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

export default function LoginPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { user, message } = loaderData;
	const fetcher = useFetcher<typeof action>();
	const form = useForm({
		mode: "uncontrolled",
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

					<Button type="submit" fullWidth size="lg">
						Login
					</Button>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
