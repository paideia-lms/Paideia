import {
	Button,
	Container,
	Group,
	Paper,
	PasswordInput,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { parseAsStringEnum } from "nuqs/server";
import { redirect } from "react-router";
import {
	createActionMap,
	typeCreateActionRpc,
} from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { USER_ROLES } from "@paideia/paideia-backend";
import type { User } from "server/types/frontend-types";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/new";

enum Action {
	Create = "create",
}

// Define search params for user creation
export const userSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(
	async ({ context, params, searchParams }) => {
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			throw new ForbiddenResponse("Unauthorized");
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			throw new ForbiddenResponse("Unauthorized");
		}

		if (currentUser.role !== "admin") {
			throw new ForbiddenResponse("Only admins can create users");
		}

		return {
			searchParams,
			params,
		};
	},
);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/user/new",
});

const createUserRpc = createActionRpc({
	formDataSchema: z.object({
		email: z.email(),
		password: z.string().min(8),
		firstName: z.string().min(1),
		lastName: z.string().min(1),
		bio: z.string().optional(),
		role: z.enum(USER_ROLES),
	}),
	method: "POST",
	action: Action.Create,
});

const createAction = createUserRpc.createAction(
	async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		if (currentUser.role !== "admin") {
			return forbidden({
				success: false,
				error: "Only admins can create users",
			});
		}

		// Create user
		const createResult = await paideia.tryCreateUser({
			data: {
				email: formData.email,
				password: formData.password,
				firstName: formData.firstName,
				lastName: formData.lastName,
				bio: formData.bio,
				role: formData.role,
			},
			overrideAccess: false,
			req: requestContext,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "User created successfully",
			id: createResult.value.id,
		});
	},
);

const useCreateUser = createUserRpc.createHook<typeof createAction>();

// Export hook for use in component
export { useCreateUser };

const [action] = createActionMap({
	[Action.Create]: createAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "User created",
			message: actionData.message || "The user has been created successfully",
			color: "green",
		});
		// Redirect to the newly created user's profile using route param
		if (actionData.id) {
			return redirect(`/user/profile/${actionData.id}`);
		}
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Creation failed",
			message: actionData?.error || "Failed to create user",
			color: "red",
		});
	}

	return actionData;
}

export default function NewUserPage() {
	const { submit: createUser, isLoading } = useCreateUser();

	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			email: "",
			password: "",
			firstName: "",
			lastName: "",
			bio: "",
			role: "student" as User["role"],
		},
		validate: {
			email: (value) => {
				if (!value) return "Email is required";
				if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
					return "Invalid email format";
				}
				return null;
			},
			password: (value) => {
				if (!value) return "Password is required";
				if (value.length < 8) return "Password must be at least 8 characters";
				return null;
			},
			firstName: (value) => (!value ? "First name is required" : null),
			lastName: (value) => (!value ? "Last name is required" : null),
			role: (value) => (!value ? "Role is required" : null),
		},
	});

	const handleSubmit = async (values: typeof form.values) => {
		await createUser({
			values: {
				email: values.email,
				password: values.password,
				firstName: values.firstName,
				lastName: values.lastName,
				bio: values.bio || undefined,
				role: (values.role ?? "student") as NonNullable<User["role"]>,
			},
		});
	};

	return (
		<Container size="sm" py="xl">
			<title>Create New User | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Create a new user account in Paideia LMS"
			/>
			<meta
				property="og:title"
				content="Create New User | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Create a new user account in Paideia LMS"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="xl">
					Create New User
				</Title>

				<form onSubmit={form.onSubmit(handleSubmit)}>
					<Stack gap="lg">
						<TextInput
							{...form.getInputProps("email")}
							key={form.key("email")}
							label="Email"
							placeholder="user@example.com"
							required
							type="email"
						/>

						<PasswordInput
							{...form.getInputProps("password")}
							key={form.key("password")}
							label="Password"
							placeholder="Enter password"
							required
							description="Password must be at least 8 characters"
						/>

						<TextInput
							{...form.getInputProps("firstName")}
							key={form.key("firstName")}
							label="First Name"
							placeholder="Enter first name"
							required
						/>

						<TextInput
							{...form.getInputProps("lastName")}
							key={form.key("lastName")}
							label="Last Name"
							placeholder="Enter last name"
							required
						/>

						<Select
							{...form.getInputProps("role")}
							key={form.key("role")}
							label="Role"
							placeholder="Select role"
							required
							data={
								[
									{ value: "admin", label: "Admin" },
									{ value: "content-manager", label: "Content Manager" },
									{ value: "analytics-viewer", label: "Analytics Viewer" },
									{ value: "instructor", label: "Instructor" },
									{ value: "student", label: "Student" },
								] satisfies {
									value: (typeof USER_ROLES)[number];
									label: string;
								}[]
							}
						/>

						<Textarea
							{...form.getInputProps("bio")}
							key={form.key("bio")}
							label="Bio"
							placeholder="Tell us about this user"
							minRows={4}
							maxRows={8}
						/>

						<Group justify="flex-end" mt="md">
							<Button type="submit" loading={isLoading} disabled={isLoading}>
								Create User
							</Button>
						</Group>
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
