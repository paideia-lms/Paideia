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
import { createLoader, parseAsStringEnum } from "nuqs/server";
import { stringify } from "qs";
import { useEffect, useState } from "react";
import { href, Link, useFetcher, useLocation } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import {
	tryFindUserById,
	tryUpdateUser,
} from "server/internal/user-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import {
	canEditOtherAdmin,
	canEditProfileAvatar,
	canEditProfileBio,
	canEditProfileEmail,
	canEditProfileFirstName,
	canEditProfileLastName,
	canEditProfileRole,
	canImpersonate,
} from "server/utils/permissions";
import z from "zod";
import { useImpersonate } from "~/routes/user/profile";
import { ContentType } from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/overview";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const { payload, envVars, payloadRequest } = context.get(globalContextKey);
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
	const profileUser = await tryFindUserById({
		payload,
		userId,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new NotFoundResponse("User not found");
	});

	// Handle avatar - could be Media object or just ID
	const avatarUrl = profileUser.avatar
		? href(`/api/media/file/:filenameOrId`, {
			filenameOrId: profileUser.avatar.toString(),
		})
		: null;

	// Check if user can impersonate
	const impersonatePermission = canImpersonate(
		userSession.authenticatedUser,
		userId,
		profileUser.role,
		userSession.isImpersonating,
	);

	// Check if this is the first user (id === 1)
	const isFirstUser = profileUser.id === 1;
	// Check if the profile user is an admin
	const isProfileUserAdmin = profileUser.role === "admin";
	// Check if sandbox mode is enabled
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;

	// Field-specific permission checks
	const firstNamePermission = canEditProfileFirstName(
		currentUser,
		profileUser,
		isSandboxMode,
	);
	const lastNamePermission = canEditProfileLastName(
		currentUser,
		profileUser,
		isSandboxMode,
	);
	const emailPermission = canEditProfileEmail();
	const bioPermission = canEditProfileBio(
		currentUser,
		profileUser,
		isSandboxMode,
	);
	const avatarPermission = canEditProfileAvatar(
		currentUser,
		profileUser,
		isSandboxMode,
	);
	const rolePermission = canEditProfileRole(
		currentUser,
		profileUser,
		isSandboxMode,
	);

	// Check if admin is trying to edit another admin (for alert display)
	const otherAdminCheck = canEditOtherAdmin(
		currentUser,
		profileUser,
		isSandboxMode,
	);
	const isEditingOtherAdminUser = otherAdminCheck.allowed;

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
		isSandboxMode,
		userProfile: userProfileContext,
		firstNamePermission,
		lastNamePermission,
		emailPermission,
		bioPermission,
		avatarPermission,
		rolePermission,
		otherAdminCheck,
		isEditingOtherAdminUser,
	};
};

enum Action {
	Update = "update",
}

// Define search params for user profile update
export const userOverviewSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

export const loadSearchParams = createLoader(userOverviewSearchParams);

const inputSchema = z.object({
	firstName: z.string(),
	lastName: z.string(),
	bio: z.string(),
	avatar: z.coerce.number().nullish(),
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
});

const updateAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
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

	const userId = params.id ? Number(params.id) : currentUser.id;

	if (userId !== currentUser.id && currentUser.role !== "admin") {
		return unauthorized({
			success: false,
			error: "Only admins can edit other users",
		});
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(
		payload,
		createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	);

	return await transactionInfo.tx(async (txInfo) => {
		// Parse form data with media upload handler
		const parseResult = await tryParseFormDataWithMediaUpload({
			payload,
			request,
			userId: userId,
			req: txInfo.reqWithTransaction,
			maxFileSize,
			fields: [
				{
					fieldName: "avatar",
					alt: "User avatar",
				},
			],
		});

		if (!parseResult.ok) {
			return handleUploadError(
				parseResult.error,
				maxFileSize,
				"Failed to parse form data",
			);
		}

		const { formData } = parseResult.value;

		const isAdmin = currentUser.role === "admin";
		const isFirstUser = userId === 1;

		const parsed = inputSchema.safeParse({
			firstName: formData.get("firstName"),
			lastName: formData.get("lastName"),
			bio: formData.get("bio"),
			avatar: formData.get("avatar"),
			email: formData.get("email"),
			role: formData.get("role"),
		});

		if (!parsed.success) {
			return badRequest({
				success: false,
				error: parsed.error.message,
			});
		}

		// Prevent first user from changing their admin role
		if (isFirstUser && parsed.data.role && parsed.data.role !== "admin") {
			return badRequest({
				success: false,
				error: "The first user cannot change their admin role",
			});
		}

		// Build update data
		const updateData = {
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			email: parsed.data.email ?? undefined,
			bio: parsed.data.bio,
			avatar: parsed.data.avatar ?? undefined,
			role: parsed.data.role ?? undefined,
		};

		// Only admins can update email and role
		if (
			isAdmin &&
			parsed.data.email !== null &&
			parsed.data.email !== undefined
		) {
			updateData.email = parsed.data.email;
		}

		const updateResult = await tryUpdateUser({
			payload,
			userId: userId,
			data: updateData,
			req: txInfo.reqWithTransaction,
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
	});
};

const getActionUrl = (action: Action, userId?: number) => {
	return (
		href("/user/overview/:id?", {
			id: userId ? userId.toString() : undefined,
		}) +
		"?" +
		stringify({ action })
	);
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

	if (actionType === Action.Update) {
		return updateAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	return badRequest({
		success: false,
		error: "Invalid action",
	});
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

const useUpdateUser = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const updateUser = (
		userId: string,
		values: {
			firstName: string;
			lastName: string;
			bio: string;
			avatar: File | null;
			email?: string;
			role?: string;
		},
	) => {
		const formData = new FormData();
		formData.append("firstName", values.firstName);
		formData.append("lastName", values.lastName);
		formData.append("bio", values.bio);
		if (values.avatar) {
			formData.append("avatar", values.avatar);
		}
		if (values.email) {
			formData.append("email", values.email);
		}
		if (values.role) {
			formData.append("role", values.role);
		}
		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl(Action.Update, Number(userId)),
			encType: ContentType.MULTIPART,
		});
	};

	return {
		updateUser,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
		fetcher,
	};
};

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
		isEditingOtherAdminUser,
	} = loaderData;
	const { updateUser, fetcher } = useUpdateUser();
	const { impersonate, isLoading: isImpersonating } = useImpersonate();

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
		updateUser(user.id.toString(), {
			firstName: values.firstName,
			lastName: values.lastName,
			bio: values.bio,
			avatar: selectedFile,
			email: emailPermission.allowed ? values.email : undefined,
			// Only include role if user can edit role
			role: rolePermission.allowed ? values.role : undefined,
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
					{canImpersonate && (
						<Button
							variant="light"
							color="orange"
							onClick={() => impersonate(user.id)}
							loading={isImpersonating}
							leftSection={<IconUserCheck size={16} />}
						>
							Impersonate User
						</Button>
					)}
				</Group>

				{/* Edit Profile Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="xl">
						Edit Profile
					</Title>

					{isEditingOtherAdminUser && (
						<Alert color="red" title="Editing Restricted" mb="xl">
							<Text size="sm">
								<strong>Warning:</strong> Admins cannot edit other admin users.
								All fields are disabled.
							</Text>
						</Alert>
					)}

					<fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
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
									loading={fetcher.state !== "idle"}
									disabled={
										fetcher.state !== "idle" ||
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
					</fetcher.Form>
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
