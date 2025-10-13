import {
	Avatar,
	Button,
	Container,
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
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateMedia } from "server/internal/media-management";
import { tryUpdateUser } from "server/internal/user-management";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/edit";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const { id } = params;

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Determine which user to edit
	let targetUserId: number;
	if (id !== undefined) {
		// If id is provided, check if the user is admin
		if (Number(id) !== currentUser.id && currentUser.role !== "admin") {
			throw new ForbiddenResponse("Only admins can edit other users");
		}
		targetUserId = Number(id);
	} else {
		// If no id provided, edit current user
		targetUserId = currentUser.id;
	}

	// Fetch the target user
	const targetUser = await payload.findByID({
		collection: "users",
		id: targetUserId,
	});

	if (!targetUser) {
		throw new NotFoundResponse("User not found");
	}

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (targetUser.avatar) {
		if (typeof targetUser.avatar === "object") {
			avatarUrl = targetUser.avatar.filename
				? href(`/api/media/file/:filename`, {
						filename: targetUser.avatar.filename,
					})
				: null;
		}
	}

	return {
		user: {
			id: targetUser.id,
			firstName: targetUser.firstName ?? "",
			lastName: targetUser.lastName ?? "",
			bio: targetUser.bio ?? "",
			avatarUrl,
		},
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const { id } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Determine which user to update
	let targetUserId: number;
	if (id !== undefined) {
		// If id is provided, check if the user is admin
		if (Number(id) !== currentUser.id && currentUser.role !== "admin") {
			return unauthorized({
				success: false,
				error: "Only admins can edit other users",
			});
		}
		targetUserId = Number(id);
	} else {
		// If no id provided, update current user
		targetUserId = currentUser.id;
	}

	// Start a transaction for atomic media creation + user update
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			success: false,
			error: "Failed to begin transaction",
		});
	}

	try {
		// Parse form data with upload handler
		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "avatar") {
				// FileUpload extends File, so we can use arrayBuffer()
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				// Create media record within transaction using tryCreateMedia
				const mediaResult = await tryCreateMedia(payload, {
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: `User avatar`,
					userId: targetUserId,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				// Return the media ID so that avatar become the media id
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

		console.log(parsed.data);

		// Update user within the same transaction
		const updateResult = await tryUpdateUser({
			payload,
			userId: targetUserId,
			data: {
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				bio: parsed.data.bio,
				avatar: parsed.data.avatar ?? undefined,
			},
			user: currentUser,
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

		// Commit the transaction
		await payload.db.commitTransaction(transactionID);

		return ok({
			success: true,
			message: "Profile updated successfully",
		});
	} catch (error) {
		// Rollback on any error
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

export default function EditProfilePage({ loaderData }: Route.ComponentProps) {
	const { user } = loaderData;
	const fetcher = useFetcher<typeof action>();
	const [avatarPreview, setAvatarPreview] = useState<string | null>(
		user.avatarUrl,
	);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const form = useForm({
		mode: "uncontrolled",
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

	return (
		<Container size="sm" py="xl">
			<title>Edit Profile | Paideia LMS</title>
			<meta
				name="description"
				content="Edit your profile information and settings"
			/>
			<meta property="og:title" content="Edit Profile | Paideia LMS" />
			<meta
				property="og:description"
				content="Edit your profile information and settings"
			/>

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
									// 5MB
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
		</Container>
	);
}
