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
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	IconBooks,
	IconEye,
	IconNotes,
	IconPhoto,
	IconTrophy,
	IconUpload,
	IconUserCheck,
	IconX,
} from "@tabler/icons-react";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { useEffect, useState } from "react";
import { href, Link, useLocation } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryUpdateUser } from "server/internal/user-management";
import z from "zod";
import { useImpersonate } from "~/routes/user/profile";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/overview";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
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
	};
};

enum Action {
	Update = "update",
}

// Define search params for user profile update
export const userOverviewSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(userOverviewSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createUpdateActionRpc = createActionRpc({
	formDataSchema: z.object({
		firstName: z.string(),
		lastName: z.string(),
		bio: z.string(),
		avatar: z.file().nullish(),
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

const [updateAction, useUpdateUser] = createUpdateActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
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
			avatar: formData.avatar ?? undefined,
			role: formData.role ?? undefined,
		};

		// Only admins can update email and role
		if (isAdmin && formData.email !== null && formData.email !== undefined) {
			updateData.email = formData.email;
		}

		const updateResult = await tryUpdateUser({
			payload,
			userId: userId,
			data: updateData,
			req: payloadRequest,
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
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(
				searchParams.action,
				params.id ? Number(params.id) : undefined,
			),
	},
);

export function getRouteUrl(action: Action, userId?: number) {
	return (
		href("/user/overview/:id?", {
			id: userId ? userId.toString() : undefined,
		}) +
		"?" +
		stringify({ action })
	);
}

const actionMap = {
	[Action.Update]: updateAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			success: false,
			error: "Action is required",
		});
	}

	return actionMap[actionType](args);
};

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

	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			avatar: user.avatarUrl,
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
			avatar: user.avatarUrl,
			firstName: user.firstName,
			lastName: user.lastName,
			bio: user.bio,
			email: user.email,
			role: user.role ?? "student",
		});
		form.reset();
	}, [location.pathname]);

	const handleDrop = (files: File[]) => {
		const file = files[0];
		if (file) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				form.setFieldValue("avatar", reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleSubmit = (values: typeof form.values) => {
		updateUser({
			params: { id: user.id },
			values: {
				firstName: values.firstName,
				lastName: values.lastName,
				bio: values.bio,
				avatar: selectedFile ?? null,
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
						to={isOwnData ? "/user/profile" : `/user/profile/${user.id}`}
						variant="light"
						leftSection={<IconEye size={16} />}
					>
						View Public Profile
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
							<Text size="sm">
								{canEdit.reason}
							</Text>
						</Alert>
					)}

					<form onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="lg">
							<div>
								<Text size="sm" fw={500} mb="xs">
									Avatar
								</Text>
								<Group gap="md">
									<Avatar
										src={form.values.avatar ?? undefined}
										alt="Profile"
										size={120}
										radius={120}
									/>
									<Dropzone
										onDrop={handleDrop}
										onReject={() => {
											notifications.show({
												title: "Upload failed",
												message: "File must be an image under 5MB",
												color: "red",
											});
										}}
										maxSize={5 * 1024 ** 2}
										accept={IMAGE_MIME_TYPE}
										multiple={false}
										disabled={!avatarPermission.allowed}
									>
										<Group
											justify="center"
											gap="xl"
											mih={100}
											style={{ pointerEvents: "none" }}
										>
											<Dropzone.Accept>
												<IconUpload
													size={32}
													color="var(--mantine-color-blue-6)"
													stroke={1.5}
												/>
											</Dropzone.Accept>
											<Dropzone.Reject>
												<IconX
													size={32}
													color="var(--mantine-color-red-6)"
													stroke={1.5}
												/>
											</Dropzone.Reject>
											<Dropzone.Idle>
												<IconPhoto
													size={32}
													color="var(--mantine-color-dimmed)"
													stroke={1.5}
												/>
											</Dropzone.Idle>

											<div>
												<Text size="sm" inline>
													Drag image here or click to select
												</Text>
												<Text size="xs" c="dimmed" inline mt={7}>
													Image should not exceed 5MB
												</Text>
											</div>
										</Group>
									</Dropzone>
								</Group>
							</div>

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
