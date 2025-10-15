import {
	Avatar,
	Button,
	Container,
	Group,
	Paper,
	PasswordInput,
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
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Users } from "server/collections/users";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateMedia } from "server/internal/media-management";
import { tryCreateUser } from "server/internal/user-management";
import type { User } from "server/payload-types";
import { enum_users_role } from "src/payload-generated-schema";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/new";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can create users");
	}

	return {
		success: true,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
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

	// Start a transaction for atomic media creation + user creation
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
					alt: "User avatar",
					userId: currentUser.id,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				// Return the media ID
				return mediaResult.value.media.id;
			}
		};

		const formData = await parseFormData(
			request,
			uploadHandler as FileUploadHandler,
		);

		const parsed = z
			.object({
				email: z.email(),
				password: z.string().min(8),
				firstName: z.string(),
				lastName: z.string(),
				bio: z.string().optional(),
				role: z.enum(enum_users_role.enumValues),
				avatar: z.coerce.number().nullish(),
			})
			.safeParse({
				email: formData.get("email"),
				password: formData.get("password"),
				firstName: formData.get("firstName"),
				lastName: formData.get("lastName"),
				bio: formData.get("bio"),
				role: formData.get("role"),
				avatar: formData.get("avatar"),
			});

		if (!parsed.success) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: parsed.error.message,
			});
		}

		// Create user within the same transaction
		const createResult = await tryCreateUser({
			payload,
			data: {
				email: parsed.data.email,
				password: parsed.data.password,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				bio: parsed.data.bio,
				role: parsed.data.role,
				avatar: parsed.data.avatar ?? undefined,
			},
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			overrideAccess: true,
			req: { ...request, transactionID },
		});

		if (!createResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		// Commit the transaction
		await payload.db.commitTransaction(transactionID);

		return ok({
			success: true,
			message: "User created successfully",
			id: createResult.value.id,
		});
	} catch (error) {
		// Rollback on any error
		await payload.db.rollbackTransaction(transactionID);
		console.error("User creation error:", error);
		return badRequest({
			success: false,
			error: error instanceof Error ? error.message : "Failed to create user",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		if (actionData.status === 200) {
			notifications.show({
				title: "User created",
				message: "The user has been created successfully",
				color: "green",
			});
			// Redirect to the newly created user's profile using route param
			throw redirect(`/user/profile/${actionData.id}`);
		}
	} else if ("error" in actionData) {
		notifications.show({
			title: "Creation failed",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function NewUserPage() {
	const fetcher = useFetcher<typeof action>();
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const form = useForm({
		mode: "uncontrolled",
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
		formData.append("email", values.email);
		formData.append("password", values.password);
		formData.append("firstName", values.firstName);
		formData.append("lastName", values.lastName);
		formData.append("bio", values.bio);
		formData.append(
			"role",
			(values.role ?? "student") as NonNullable<User["role"]>,
		);

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
							data={Users.fields[2].options?.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
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
							<Button
								type="submit"
								loading={fetcher.state !== "idle"}
								disabled={fetcher.state !== "idle"}
							>
								Create User
							</Button>
						</Group>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
