import { notifications } from "@mantine/notifications";
import { dbContextKey } from "server/contexts/global-context";
import { registerFirstUser } from "server/internal/register-first-user";
import { z } from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { ok } from "~/utils/responses";
import type { Route } from "./+types/first-user";

export async function loader({ context }: Route.LoaderArgs) {
	const payload = context.get(dbContextKey).payload;

	// Check if we already have users - if so, redirect to admin
	const users = await payload.find({
		collection: "users",
		limit: 1,
	});

	if (users.docs.length > 0) {
		throw new NotFoundResponse("Not Found");
	}

	return {};
}

const formSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	firstName: z.string(),
	lastName: z.string(),
});

export async function action({ request, context }: Route.ActionArgs) {
	const { payload, requestInfo } = context.get(dbContextKey);

	const { contentType, data } = await getDataAndContentTypeFromRequest(request);

	try {
		const parsedData = formSchema.parse(data);

		const result = await registerFirstUser(payload, request, { ...parsedData });

		if (!result.token || !result.exp) {
			return {
				success: false,
				error: "Registration failed, no token or exp",
			};
		}

		// set the cookie
		return ok(
			{
				success: true,
				message: "First user created successfully",
			},
			{
				headers: {
					"Set-Cookie": setCookie(
						result.token,
						result.exp,
						requestInfo.domainUrl,
					),
				},
			},
		);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Registration failed",
		};
	}
}

export async function clientAction({
	request,
	serverAction,
}: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "First user created successfully",
			message: "Welcome to Paideia LMS! You are now logged in as admin.",
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

export default function CreateFirstUserView({
	loaderData,
}: Route.ComponentProps) {
	return (
		<div style={{ padding: "20px", maxWidth: "500px", margin: "50px auto" }}>
			<h1>Create First User</h1>
			<p>Welcome! Please create the first user account to get started.</p>
			<CreateFirstUserClient />
		</div>
	);
}

import { Button, PasswordInput, TextInput } from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { useFetcher } from "react-router";
import { setCookie } from "~/utils/cookie";
import { NotFoundResponse } from "~/utils/responses";

export function CreateFirstUserClient() {
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

	return (
		<fetcher.Form
			method="POST"
			onSubmit={form.onSubmit((values) => {
				fetcher.submit(values, {
					method: "POST",
					encType: "application/json",
				});
			})}
			style={{ display: "flex", flexDirection: "column", gap: "16px" }}
		>
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
				Create First User
			</Button>
		</fetcher.Form>
	);
}
