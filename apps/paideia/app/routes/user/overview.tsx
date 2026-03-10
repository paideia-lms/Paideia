import {
	Alert,
	Avatar,
	Button,
	Card,
	Container,
	Grid,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	IconBooks,
	IconEye,
	IconKey,
	IconNotes,
	IconPhoto,
	IconTrophy,
	IconUserCheck,
	IconX,
} from "@tabler/icons-react";
import { parseAsStringEnum } from "nuqs/server";
import { useEffect, useRef } from "react";
import { href, Link, useLocation } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import z from "zod";
import {
	MediaPickerModal,
	type MediaPickerModalHandle,
} from "app/components/media-picker";
import { useImpersonate } from "~/routes/user/profile";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/overview";
import {
	typeCreateActionRpc,
	createActionMap,
} from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const userSession = context.get(userContextKey);
	const userProfileContext = context.get(userProfileContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User profile context not found");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	// Fetch the user profile
	const profileUser = userProfileContext.profileUser;

	// Handle avatar - could be Media object or just ID
	const avatarUrl = profileUser.avatarUrl;

	// Check if this is the first user (id === 1)
	const isFirstUser = profileUser.id === 1;
	// Check if the profile user is an admin
	const isProfileUserAdmin = profileUser.role === "admin";

	// Get permissions from context
	const {
		canImpersonate: impersonatePermission,
		firstName: firstNamePermission,
		lastName: lastNamePermission,
		email: emailPermission,
		bio: bioPermission,
		avatar: avatarPermission,
		role: rolePermission,
		canEdit,
	} = userProfileContext.permissions;

	return {
		user: {
			id: profileUser.id,
			firstName: profileUser.firstName ?? "",
			lastName: profileUser.lastName ?? "",
			bio: profileUser.bio ?? "",
			email: profileUser.email,
			role: profileUser.role,
			avatarUrl,
			avatar: profileUser.avatar,
		},
		currentUser: {
			id: currentUser.id,
			role: currentUser.role,
		},
		isOwnData: userId === currentUser.id,
		isAdmin: currentUser.role === "admin",
		canImpersonate: impersonatePermission.allowed,
		isFirstUser,
		isProfileUserAdmin,
		userProfile: userProfileContext,
		firstNamePermission,
		lastNamePermission,
		emailPermission,
		bioPermission,
		avatarPermission,
		rolePermission,
		canEdit,
		params,
	};
})!;

enum Action {
	Update = "update",
}

// Define search params for user profile update (used in actions)
export const userOverviewSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/overview/:id?",
});

const createUpdateActionRpc = createActionRpc({
	formDataSchema: z.object({
		firstName: z.string(),
		lastName: z.string(),
		bio: z.string(),
		avatar: z.number().nullable(),
		email: z.email().nullish(),
		role: z
			.enum([
				"student",
				"instructor",
				"content-manager",
				"analytics-viewer",
				"admin",
			])
			.nullish(),
	}),
	method: "POST",
	action: Action.Update,
});

const updateAction = createUpdateActionRpc.createAction(
	async ({ context, params, formData }) => {
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

		const userId = params.id ? Number(params.id) : currentUser.id;

		if (userId !== currentUser.id && currentUser.role !== "admin") {
			return unauthorized({
				success: false,
				error: "Only admins can edit other users",
			});
		}

		const isAdmin = currentUser.role === "admin";
		const isFirstUser = userId === 1;

		// Prevent first user from changing their admin role
		if (isFirstUser && formData.role && formData.role !== "admin") {
			return badRequest({
				success: false,
				error: "The first user cannot change their admin role",
			});
		}

		// Build update data
		const updateData = {
			firstName: formData.firstName,
			lastName: formData.lastName,
			email: formData.email ?? undefined,
			bio: formData.bio,
			avatar: formData.avatar,
			role: formData.role ?? undefined,
		};

		// Only admins can update email and role
		if (isAdmin && formData.email !== null && formData.email !== undefined) {
			updateData.email = formData.email;
		}

		const updateResult = await paideia.tryUpdateUser({
			userId: userId,
			data: updateData,
			req: requestContext,
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			return badRequest({
				success: false,
				error: updateResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Profile updated successfully",
		});
	},
);

const useUpdateUser = createUpdateActionRpc.createHook<typeof updateAction>();

const [action] = createActionMap({
	[Action.Update]: updateAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Profile updated",
			message:
				actionData.message || "Your profile has been updated successfully",
			color: "green",
		});
	} else if (
		actionData.status === StatusCode.BadRequest ||
		actionData.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Update failed",
			message: actionData?.error || "Failed to update profile",
			color: "red",
		});
	}

	return actionData;
}

interface ImpersonateButtonProps {
	userId: number;
}

function ImpersonateButton({ userId }: ImpersonateButtonProps) {
	const { submit: impersonate, isLoading: isImpersonating } = useImpersonate();

	return (
		<Button
			variant="light"
			color="orange"
			onClick={() =>
				impersonate({
					params: {
						id: userId,
					},
					values: {},
				})
			}
			loading={isImpersonating}
			leftSection={<IconUserCheck size={16} />}
		>
			Impersonate User
		</Button>
	);
}

export default function UserOverviewPage({ loaderData }: Route.ComponentProps) {
	const {
		user,
		isOwnData,
		isAdmin,
		canImpersonate,
		userProfile,
		firstNamePermission,
		lastNamePermission,
		emailPermission,
		bioPermission,
		avatarPermission,
		rolePermission,
		canEdit,
	} = loaderData;
	const { submit: updateUser, isLoading: isUpdating } = useUpdateUser();

	const location = useLocation();
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			avatar: user.avatar ?? null,
			firstName: user.firstName,
			lastName: user.lastName,
			bio: user.bio,
			email: user.email,
			role: user.role ?? "student",
		},
		validate: {
			firstName: (value) => (!value ? "First name is required" : null),
			lastName: (value) => (!value ? "Last name is required" : null),
			email: (value) => {
				if (isAdmin) {
					if (!value) return "Email is required";
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
						return "Invalid email address";
					}
				}
				return null;
			},
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form when pathname changes
	useEffect(() => {
		// when the pathname changes, we need to set the form values to the user values
		form.setInitialValues({
			avatar: user.avatar ?? null,
			firstName: user.firstName,
			lastName: user.lastName,
			bio: user.bio,
			email: user.email,
			role: user.role ?? "student",
		});
		form.reset();
	}, [location.pathname]);

	const handleSubmit = async (values: typeof form.values) => {
		await updateUser({
			params: { id: user.id },
			values: {
				firstName: values.firstName,
				lastName: values.lastName,
				bio: values.bio,
				avatar: values.avatar,
				email: emailPermission.allowed ? values.email : null,
				// Only include role if user can edit role
				role: rolePermission.allowed ? values.role : null,
			},
		});
	};

	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const moduleCount = userProfile?.activityModules.length ?? 0;
	const enrollmentCount = userProfile?.enrollments.length ?? 0;

	const title = `${fullName} | Profile | Paideia LMS`;

	return (
		<Container size="lg" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`Edit ${isOwnData ? "your" : fullName + "'s"} profile`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`Edit ${isOwnData ? "your" : fullName + "'s"} profile`}
			/>

			<Stack gap="xl">
				{/* Action Buttons */}
				<Group justify="flex-end">
					<Button
						component={Link}
						to={href("/user/profile/:id?", {
							id: isOwnData ? undefined : user.id.toString(),
						})}
						variant="light"
						leftSection={<IconEye size={16} />}
					>
						View Public Profile
					</Button>
					<Button
						component={Link}
						to={href("/user/api-keys/:id?", {
							id: isOwnData ? undefined : user.id.toString(),
						})}
						variant="light"
						leftSection={<IconKey size={16} />}
					>
						API Keys
					</Button>
					{canImpersonate && <ImpersonateButton userId={user.id} />}
				</Group>

				{/* Edit Profile Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="xl">
						Edit Profile
					</Title>

					{!canEdit.allowed && (
						<Alert color="red" title="Editing Restricted" mb="xl">
							<Text size="sm">{canEdit.reason}</Text>
						</Alert>
					)}

					<form onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="lg">
							{avatarPermission.allowed && (
								<Stack gap="xs">
									<Text size="sm" fw={500} component="label">
										Avatar
									</Text>
									<Group gap="md">
										<Avatar
											src={
												form.values.avatar
													? href("/api/media/file/:mediaId", {
															mediaId: form.values.avatar.toString(),
														})
													: null
											}
											alt={fullName}
											size={80}
											radius="xl"
										/>
										<Group gap="xs">
											<Button
												type="button"
												variant="light"
												size="sm"
												leftSection={<IconPhoto size={16} />}
												onClick={() => mediaPickerRef.current?.open()}
											>
												Choose avatar
											</Button>
											{form.values.avatar && (
												<Button
													type="button"
													variant="subtle"
													size="sm"
													leftSection={<IconX size={16} />}
													color="red"
													onClick={() => form.setFieldValue("avatar", null)}
												>
													Remove
												</Button>
											)}
										</Group>
									</Group>
								</Stack>
							)}

							<TextInput
								{...form.getInputProps("firstName")}
								key={form.key("firstName")}
								label="First Name"
								placeholder="Enter your first name"
								required
								disabled={!firstNamePermission.allowed}
								description={
									!firstNamePermission.allowed
										? firstNamePermission.reason
										: undefined
								}
							/>

							<TextInput
								{...form.getInputProps("lastName")}
								key={form.key("lastName")}
								label="Last Name"
								placeholder="Enter your last name"
								required
								disabled={!lastNamePermission.allowed}
								description={
									!lastNamePermission.allowed
										? lastNamePermission.reason
										: undefined
								}
							/>

							<TextInput
								{...form.getInputProps("email")}
								key={form.key("email")}
								label="Email"
								placeholder="user@example.com"
								type="email"
								required={isAdmin}
								readOnly={!emailPermission.allowed}
								disabled={!emailPermission.allowed}
								description={emailPermission.reason}
							/>

							<Select
								{...form.getInputProps("role")}
								key={form.key("role")}
								label="System Role"
								placeholder="Select user role"
								disabled={!rolePermission.allowed}
								required
								data={[
									{ value: "student", label: "Student" },
									{ value: "instructor", label: "Instructor" },
									{ value: "content-manager", label: "Content Manager" },
									{ value: "analytics-viewer", label: "Analytics Viewer" },
									{ value: "admin", label: "Administrator" },
								]}
								description={rolePermission.reason}
							/>

							<Textarea
								{...form.getInputProps("bio")}
								key={form.key("bio")}
								label="Bio"
								placeholder="Tell us about yourself"
								minRows={4}
								maxRows={8}
								disabled={!bioPermission.allowed}
								description={
									!bioPermission.allowed ? bioPermission.reason : undefined
								}
							/>

							<Group justify="flex-end" mt="md">
								<Button
									type="submit"
									loading={isUpdating}
									disabled={
										isUpdating ||
										!firstNamePermission.allowed ||
										!lastNamePermission.allowed ||
										!bioPermission.allowed ||
										!avatarPermission.allowed
									}
								>
									Save Changes
								</Button>
							</Group>
						</Stack>
					</form>

					<MediaPickerModal
						ref={mediaPickerRef}
						userId={user.id}
						onSelect={(mediaId) => {
							form.setFieldValue("avatar", mediaId);
						}}
						imagesOnly
					/>
				</Paper>

				{/* Quick Stats Cards */}
				<Grid>
					<Grid.Col span={{ base: 12, sm: 4 }}>
						<Card withBorder shadow="sm" padding="lg" radius="md">
							<Group justify="space-between" mb="xs">
								<Text size="sm" fw={500}>
									Enrollments
								</Text>
								<IconTrophy size={20} color="var(--mantine-color-blue-6)" />
							</Group>
							<Text size="xl" fw={700} mb="md">
								{enrollmentCount}
							</Text>
							{userProfile && userProfile.enrollments.length > 0 && (
								<Stack gap="xs">
									{userProfile.enrollments.slice(0, 3).map((enrollment) => (
										<Text
											key={enrollment.id}
											size="xs"
											component={Link}
											to={`/course/${enrollment.course.id}`}
											style={{
												color: "var(--mantine-color-blue-6)",
												textDecoration: "none",
											}}
										>
											• {enrollment.course.title}
										</Text>
									))}
									{userProfile.enrollments.length > 3 && (
										<Text size="xs" c="dimmed">
											+{userProfile.enrollments.length - 3} more
										</Text>
									)}
								</Stack>
							)}
							<Button
								component={Link}
								to="/course"
								variant="light"
								size="xs"
								mt="md"
								fullWidth
							>
								View All Courses
							</Button>
						</Card>
					</Grid.Col>

					<Grid.Col span={{ base: 12, sm: 4 }}>
						<Card withBorder shadow="sm" padding="lg" radius="md">
							<Group justify="space-between" mb="xs">
								<Text size="sm" fw={500}>
									Activity Modules
								</Text>
								<IconBooks size={20} color="var(--mantine-color-green-6)" />
							</Group>
							<Text size="xl" fw={700}>
								{moduleCount}
							</Text>
							<Button
								component={Link}
								to={isOwnData ? "/user/modules" : `/user/modules/${user.id}`}
								variant="light"
								size="xs"
								mt="md"
								fullWidth
							>
								View Modules
							</Button>
						</Card>
					</Grid.Col>

					<Grid.Col span={{ base: 12, sm: 4 }}>
						<Card withBorder shadow="sm" padding="lg" radius="md">
							<Group justify="space-between" mb="xs">
								<Text size="sm" fw={500}>
									Notes
								</Text>
								<IconNotes size={20} color="var(--mantine-color-orange-6)" />
							</Group>
							<Text size="xl" fw={700}>
								-
							</Text>
							<Button
								component={Link}
								to={isOwnData ? "/user/notes" : `/user/notes/${user.id}`}
								variant="light"
								size="xs"
								mt="md"
								fullWidth
							>
								View Notes
							</Button>
						</Card>
					</Grid.Col>
				</Grid>
			</Stack>
		</Container>
	);
}
