import {
	Avatar,
	Badge,
	Button,
	Card,
	Container,
	Grid,
	Group,
	Paper,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import {
	IconBooks,
	IconEye,
	IconNotes,
	IconPhoto,
	IconTrophy,
	IconUpload,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryCreateMedia } from "server/internal/media-management";
import {
	tryFindUserById,
	tryUpdateUser,
} from "server/internal/user-management";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/overview";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
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
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	// Fetch the user profile
	const userResult = await tryFindUserById({
		payload,
		userId,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!userResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	const profileUser = userResult.value;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (profileUser.avatar) {
		if (typeof profileUser.avatar === "object") {
			avatarUrl = profileUser.avatar.filename
				? href(`/api/media/file/:filenameOrId`, {
					filenameOrId: profileUser.avatar.filename,
				})
				: null;
		}
	}

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
		isOwnData: userId === currentUser.id,
		userProfile: userProfileContext,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const userId = params.id ? Number(params.id) : currentUser.id;

	if (userId !== currentUser.id && currentUser.role !== "admin") {
		return unauthorized({
			success: false,
			error: "Only admins can edit other users",
		});
	}

	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			success: false,
			error: "Failed to begin transaction",
		});
	}

	try {
		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "avatar") {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				const mediaResult = await tryCreateMedia(payload, {
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: `User avatar`,
					userId: userId,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				return mediaResult.value.media.id;
			}
		};

		const formData = await parseFormData(
			request,
			uploadHandler as FileUploadHandler,
		);

		const parsed = z
			.object({
				firstName: z.string(),
				lastName: z.string(),
				bio: z.string(),
				avatar: z.coerce.number().nullish(),
			})
			.safeParse({
				firstName: formData.get("firstName"),
				lastName: formData.get("lastName"),
				bio: formData.get("bio"),
				avatar: formData.get("avatar"),
			});

		if (!parsed.success) {
			return badRequest({
				success: false,
				error: parsed.error.message,
			});
		}

		const updateResult = await tryUpdateUser({
			payload,
			userId: userId,
			data: {
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				bio: parsed.data.bio,
				avatar: parsed.data.avatar ?? undefined,
			},
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			overrideAccess: false,
			transactionID,
		});

		if (!updateResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: updateResult.error.message,
			});
		}

		await payload.db.commitTransaction(transactionID);

		return ok({
			success: true,
			message: "Profile updated successfully",
		});
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Profile update error:", error);
		return badRequest({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to update profile",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "Profile updated",
			message: "Your profile has been updated successfully",
			color: "green",
		});
	} else if ("error" in actionData) {
		notifications.show({
			title: "Update failed",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function UserOverviewPage({ loaderData }: Route.ComponentProps) {
	const { user, isOwnData, userProfile } = loaderData;
	const fetcher = useFetcher<typeof action>();
	const [avatarPreview, setAvatarPreview] = useState<string | null>(
		user.avatarUrl,
	);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			firstName: user.firstName,
			lastName: user.lastName,
			bio: user.bio,
		},
		validate: {
			firstName: (value) => (!value ? "First name is required" : null),
			lastName: (value) => (!value ? "Last name is required" : null),
		},
	});

	const handleDrop = (files: File[]) => {
		const file = files[0];
		if (file) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setAvatarPreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleSubmit = (values: typeof form.values) => {
		const formData = new FormData();
		formData.append("firstName", values.firstName);
		formData.append("lastName", values.lastName);
		formData.append("bio", values.bio);

		if (selectedFile) {
			formData.append("avatar", selectedFile);
		}

		fetcher.submit(formData, {
			method: "POST",
			encType: "multipart/form-data",
		});
	};

	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const moduleCount = userProfile?.activityModules.length ?? 0;
	const enrollmentCount = userProfile?.enrollments.length ?? 0;

	return (
		<Container size="lg" py="xl">
			<title>{`${fullName} | Profile | Paideia LMS`}</title>
			<meta
				name="description"
				content={`Edit ${isOwnData ? "your" : fullName + "'s"} profile`}
			/>
			<meta
				property="og:title"
				content={`${fullName} | Profile | Paideia LMS`}
			/>
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
				</Group>

				{/* Edit Profile Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="xl">
						Edit Profile
					</Title>

					<fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="lg">
							<div>
								<Text size="sm" fw={500} mb="xs">
									Avatar
								</Text>
								<Stack align="center" gap="md">
									<Avatar
										src={avatarPreview}
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
										style={{ width: "100%" }}
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
								</Stack>
							</div>

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

							<Textarea
								{...form.getInputProps("bio")}
								key={form.key("bio")}
								label="Bio"
								placeholder="Tell us about yourself"
								minRows={4}
								maxRows={8}
							/>

							<Group justify="flex-end" mt="md">
								<Button
									type="submit"
									loading={fetcher.state !== "idle"}
									disabled={fetcher.state !== "idle"}
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
