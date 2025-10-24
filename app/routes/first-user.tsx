import { Button, PasswordInput, TextInput } from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryRegisterFirstUser } from "server/internal/user-management";
import { devConstants } from "server/utils/constants";
import { z } from "zod";
import { setCookie } from "~/utils/cookie";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/first-user";

export async function loader({ context }: Route.LoaderArgs) {
	const payload = context.get(globalContextKey).payload;

	// Check if we already have users - if so, redirect to admin
	const users = await payload.find({
		collection: "users",
		limit: 1,
	});

	if (users.docs.length > 0) {
		throw new NotFoundResponse("Not Found");
	}

	return {
		NODE_ENV: process.env.NODE_ENV,
		DEV_CONSTANTS: devConstants,
	};
}

const formSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	firstName: z.string(),
	lastName: z.string(),
});

export async function action({ request, context }: Route.ActionArgs) {
	const { payload, requestInfo } = context.get(globalContextKey);

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsed = formSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.message,
		});
	}

	const result = await tryRegisterFirstUser({
		payload,
		...parsed.data,
		req: request,
	});

	if (!result.ok) {
		return badRequest({
			success: false,
			error: result.error.message,
		});
	}

	const { token, exp } = result.value;

	// set the cookie
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
	const { NODE_ENV, DEV_CONSTANTS } = loaderData;

	return (
		<div style={{ padding: "20px", maxWidth: "500px", margin: "50px auto" }}>
			<title>Create First User | Paideia LMS</title>
			<meta
				name="description"
				content="Create the first administrator account for Paideia LMS"
			/>
			<meta property="og:title" content="Create First User | Paideia LMS" />
			<meta
				property="og:description"
				content="Create the first administrator account for Paideia LMS"
			/>

			<h1>Create First User</h1>
			<p>Welcome! Please create the first user account to get started.</p>
			<CreateFirstUserClient
				NODE_ENV={NODE_ENV}
				DEV_CONSTANTS={DEV_CONSTANTS}
			/>
		</div>
	);
}

export function CreateFirstUserClient({
	NODE_ENV,
	DEV_CONSTANTS,
}: {
	NODE_ENV: string | undefined;
	DEV_CONSTANTS: typeof devConstants;
}) {
	const fetcher = useFetcher<typeof action>();

	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
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
				fetcher.submit(values, {
					method: "POST",
					encType: "application/json",
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
