import {
	Button,
	Container,
	Group,
	Input,
	Paper,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { href, redirect, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CategoryTreeNode,
	tryGetCategoryTree,
} from "server/internal/course-category-management";
import { tryUpdateCourse } from "server/internal/course-management";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import type { Course } from "server/payload-types";
import { canSeeCourseSettings } from "server/utils/permissions";
import z from "zod";
import type { ImageFile } from "~/components/rich-text-editor";
import { RichTextEditor } from "~/components/rich-text-editor";
import { handleUploadError } from "~/utils/handle-upload-errors";
import { replaceBase64ImagesWithMediaUrls } from "~/utils/replace-base64-images";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/course.$id.settings";

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	const { course } = courseContext;

	// Check if user can edit this course
	const canEdit = canSeeCourseSettings(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment,
	);

	if (!canEdit) {
		throw new ForbiddenResponse(
			"You don't have permission to edit this course",
		);
	}

	// Fetch categories via internal functions and flatten
	// const categoryTreeResult = await (await import("server/internal/course-category-management")).tryGetCategoryTree(payload);
	const categoriesResult = await tryGetCategoryTree({
		payload,
		req: request,
		user: currentUser,
	});
	if (!categoriesResult.ok) {
		throw new ForbiddenResponse("Failed to get categories");
	}
	const categories = categoriesResult.value;
	const flatCategories: { value: string; label: string }[] = [];
	const visit = (nodes: CategoryTreeNode[], prefix: string) => {
		for (const n of nodes) {
			flatCategories.push({ value: String(n.id), label: `${prefix}${n.name}` });
			if (n.subcategories?.length) visit(n.subcategories, `${prefix}— `);
		}
	};
	visit(categories, "");

	// Handle thumbnail - could be Media object, just ID, or null
	const thumbnailFileNameOrId = course.thumbnail
		? typeof course.thumbnail === "object"
			? course.thumbnail.filename || course.thumbnail.id?.toString()
			: course.thumbnail.toString()
		: null;

	const thumbnailUrl = thumbnailFileNameOrId
		? href("/api/media/file/:filenameOrId", {
				filenameOrId: thumbnailFileNameOrId,
			})
		: null;

	return {
		success: true,
		course: {
			id: course.id,
			title: course.title,
			slug: course.slug,
			description: course.description,
			status: course.status,
			category: course.category,
			thumbnailUrl,
		},
		categories: flatCategories,
	};
};

const inputSchema = z.object({
	title: z.string().min(1, "Title is required"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		),
	description: z.string().min(1, "Description is required"),
	status: z.enum(["draft", "published", "archived"]),
	category: z.coerce.number().nullish(),
	redirectTo: z.string().optional().nullable(),
});

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { courseId } = params;
	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Get user's enrollment for this course
	const enrollments = await payload.find({
		collection: "enrollments",
		where: {
			and: [
				{ user: { equals: currentUser.id } },
				{ course: { equals: courseId } },
			],
		},
		limit: 1,
	});

	const enrollment = enrollments.docs[0];

	// Check if user has permission to edit settings
	const canEdit = canSeeCourseSettings(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrollment,
	);

	if (!canEdit) {
		return unauthorized({
			success: false,
			error: "You don't have permission to edit this course",
		});
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload);

	// Store thumbnail media ID
	let thumbnailMediaId: number | undefined;

	// Parse form data with media upload handler
	const parseResult = await tryParseFormDataWithMediaUpload({
		payload,
		request,
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		maxFileSize,
		fields: [
			{
				fieldName: "thumbnail",
				alt: "Course thumbnail",
				onUpload: (_fieldName, mediaId) => {
					thumbnailMediaId = mediaId;
				},
			},
			{
				fieldName: "image-*",
				alt: "Course description image",
			},
		],
	});

	if (!parseResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return handleUploadError(
			parseResult.error,
			maxFileSize,
			"Failed to parse form data",
		);
	}

	const { formData, uploadedMedia } = parseResult.value;

	const parsed = inputSchema.safeParse(formData);

	if (!parsed.success) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: parsed.error.issues[0]?.message ?? "Validation error",
		});
	}

	let description = parsed.data.description;

	// Replace base64 images with actual media URLs
	description = replaceBase64ImagesWithMediaUrls(
		description,
		uploadedMedia,
		formData,
	);

	// Update course (within the same transaction)
	const updateResult = await tryUpdateCourse({
		payload,
		courseId: Number(courseId),
		data: {
			title: parsed.data.title,
			description,
			status: parsed.data.status,
			thumbnail: thumbnailMediaId,
			category: parsed.data.category,
		},
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		overrideAccess: true,
	});

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Course updated successfully",
		id: courseId,
		redirectTo: parsed.data.redirectTo ?? null,
	});
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Course updated",
			message: actionData.message,
			color: "green",
		});
		// Redirect to provided location if specified; otherwise to the course's view page
		if (actionData.redirectTo) {
			throw redirect(actionData.redirectTo);
		}
		throw redirect(
			href("/course/:courseId", { courseId: String(actionData.id) }),
		);
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Update failed",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

export function useEditCourse() {
	const fetcher = useFetcher<typeof action>();
	const editCourse = async (courseId: number, formData: FormData) => {
		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/:courseId/settings", {
				courseId: String(courseId),
			}),
			encType: "multipart/form-data",
		});
	};
	return { editCourse, isLoading: fetcher.state !== "idle", fetcher };
}

export default function EditCoursePage({ loaderData }: Route.ComponentProps) {
	const { course, categories } = loaderData;
	const { editCourse, isLoading, fetcher } = useEditCourse();
	const descriptionId = useId();
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
	const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
		course.thumbnailUrl,
	);
	const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);

	const handleImageAdd = (imageFile: ImageFile) => {
		setImageFiles((prev) => [...prev, imageFile]);
	};

	const handleThumbnailDrop = (files: File[]) => {
		const file = files[0];
		if (file) {
			setSelectedThumbnail(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setThumbnailPreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	// Initialize form with default values (hooks must be called unconditionally)
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: course.title,
			slug: course.slug,
			status: course.status as Course["status"],
			category: course.category?.id?.toString() ?? "",
			description: course.description,
		},
		validate: {
			title: (value) => (!value ? "Title is required" : null),
			slug: (value) => {
				if (!value) return "Slug is required";
				if (!/^[a-z0-9-]+$/.test(value)) {
					return "Slug must contain only lowercase letters, numbers, and hyphens";
				}
				return null;
			},
			status: (value) => (!value ? "Status is required" : null),
			description: (value) => (!value ? "Description is required" : null),
		},
	});

	const handleSubmit = (values: typeof form.values) => {
		if (!values.description || values.description.trim().length === 0) {
			return;
		}
		const formData = new FormData();
		formData.append("title", values.title);
		formData.append("slug", values.slug);
		formData.append("description", values.description);
		formData.append("status", values.status ?? "draft");

		if (values.category) {
			formData.append("category", values.category);
		}

		// Add thumbnail if selected
		if (selectedThumbnail) {
			formData.append("thumbnail", selectedThumbnail);
		}

		// Add each image file with a unique field name
		imageFiles.forEach((imageFile, index) => {
			formData.append(`image-${index}`, imageFile.file);
			formData.append(`image-${index}-preview`, imageFile.preview);
		});

		editCourse(course.id, formData);
	};

	return (
		<Container size="xl" py="xl">
			<title>Edit Course | Paideia LMS</title>
			<meta name="description" content="Edit course in Paideia LMS" />
			<meta property="og:title" content="Edit Course | Paideia LMS" />
			<meta property="og:description" content="Edit course in Paideia LMS" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="xl">
					Edit Course
				</Title>

				<fetcher.Form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
					<Stack gap="lg">
						<TextInput
							{...form.getInputProps("title")}
							key={form.key("title")}
							label="Title"
							placeholder="Introduction to Computer Science"
							required
						/>

						<TextInput
							{...form.getInputProps("slug")}
							key={form.key("slug")}
							label="Slug"
							placeholder="cs-101-spring-2025"
							required
							description="Only lowercase letters, numbers, and hyphens"
							disabled
						/>

						<div>
							<Text size="sm" fw={500} mb="xs">
								Thumbnail
							</Text>
							<Stack align="center" gap="md">
								{thumbnailPreview && (
									<div
										style={{
											width: "100%",
											maxWidth: 400,
											height: 200,
											borderRadius: 8,
											overflow: "hidden",
											backgroundColor: "#f8f9fa",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<img
											src={thumbnailPreview}
											alt="Course thumbnail"
											style={{
												width: "100%",
												height: "100%",
												objectFit: "cover",
											}}
										/>
									</div>
								)}
								<Dropzone
									onDrop={handleThumbnailDrop}
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

						<Input.Wrapper label="Description" required>
							<div id={descriptionId}>
								<RichTextEditor
									content={form.getValues().description}
									onChange={(v) => form.setFieldValue("description", v)}
									onImageAdd={handleImageAdd}
									placeholder="Enter course description"
								/>
							</div>
							{!form.getValues().description && (
								<div
									style={{ color: "red", fontSize: "14px", marginTop: "4px" }}
								>
									Description is required
								</div>
							)}
						</Input.Wrapper>

						<Select
							{...form.getInputProps("status")}
							key={form.key("status")}
							label="Status"
							placeholder="Select status"
							required
							data={[
								{ value: "draft", label: "Draft" },
								{ value: "published", label: "Published" },
								{ value: "archived", label: "Archived" },
							]}
						/>

						<Select
							{...form.getInputProps("category")}
							key={form.key("category")}
							label="Category"
							placeholder="Select category (optional)"
							data={categories}
							clearable
						/>

						<Group justify="flex-end" mt="md">
							<Button type="submit" loading={isLoading} disabled={isLoading}>
								Update Course
							</Button>
						</Group>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
