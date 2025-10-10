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
import type { TypedUser } from "payload";
import { useState } from "react";
import { href, useFetcher } from "react-router";
import { dbContextKey } from "server/contexts/global-context";
import { tryUpdateUser } from "server/internal/user-management";
import z from "zod";
import { getTokenFromCookie } from "~/utils/cookie";
import {
	badRequest,
	NotFoundResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/edit";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(dbContextKey).payload;
	const unstorage = context.get(dbContextKey).unstorage;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	await unstorage.setItem(
		`user:${getTokenFromCookie(request.headers)}`,
		currentUser,
	);

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (currentUser.avatar) {
		if (typeof currentUser.avatar === "object") {
			avatarUrl = currentUser.avatar.filename
				? href(`/api/media/file/:filename`, {
						filename: currentUser.avatar.filename,
					})
				: null;
		}
	}

	return {
		user: {
			id: currentUser.id,
			firstName: currentUser.firstName ?? "",
			lastName: currentUser.lastName ?? "",
			bio: currentUser.bio ?? "",
			avatarUrl,
		},
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const payload = context.get(dbContextKey).payload;
	const unstorage = context.get(dbContextKey).unstorage;
	const token = getTokenFromCookie(request.headers);
	if (token === null)
		throw unauthorized({
			success: false,
			error: "Unauthorized",
		});

	const currentUser = await unstorage.getItem<TypedUser>(`user:${token}`);
	if (currentUser === null) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
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

				// Create media record within transaction
				const media = await payload.create({
					collection: "media",
					data: {
						alt: `${currentUser.firstName} ${currentUser.lastName} avatar`,
						caption: null,
					},
					file: {
						data: fileBuffer,
						name: fileUpload.name,
						size: fileUpload.size,
						mimetype: fileUpload.type,
					},
					req: { transactionID },
				});

				console.log(media);
				// Return a placeholder - the actual file was already processed
				return media.id;
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
			userId: currentUser.id,
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
