import {
	Button,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import * as cheerio from "cheerio";
import { useId, useState } from "react";
import { href, redirect, useFetcher } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCourse } from "server/internal/course-management";
import { tryCreateMedia } from "server/internal/media-management";
import type { Course } from "server/payload-types";
import { canSeeCourseSettings } from "server/utils/permissions";
import z from "zod";
import type { ImageFile } from "~/components/rich-text-editor";
import { RichTextEditor } from "~/components/rich-text-editor";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.settings";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			error: "Invalid course ID",
		});
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;
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

	// Fetch categories for the dropdown
	const categories = await payload.find({
		collection: "course-categories",
		limit: 100,
		sort: "name",
	});

	const categoryId =
		typeof course.category === "number"
			? course.category
			: (course.category?.id ?? null);

	return {
		success: true,
		course: {
			id: course.id,
			title: course.title,
			slug: course.slug,
			description: course.description,
			status: course.status,
			category: categoryId,
		},
		categories: categories.docs.map((cat) => ({
			value: cat.id.toString(),
			label: cat.name,
		})),
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

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const courseId = Number.parseInt(id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			success: false,
			error: "Invalid course ID",
		});
	}

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

	// Start transaction for atomic media creation + course update
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			success: false,
			error: "Failed to begin transaction",
		});
	}

	try {
		// Store uploaded media info - map fieldName to uploaded filename
		const uploadedMedia: { fieldName: string; filename: string }[] = [];

		// Parse form data with upload handler
		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName.startsWith("image-")) {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				// Create media record within transaction
				const mediaResult = await tryCreateMedia(payload, {
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: "Course description image",
					userId: currentUser.id,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				// Store the field name and filename for later matching
				uploadedMedia.push({
					fieldName: fileUpload.fieldName,
					filename: mediaResult.value.media.filename ?? fileUpload.name,
				});

				return mediaResult.value.media.id;
			}
		};

		const formData = await parseFormData(
			request,
			uploadHandler as FileUploadHandler,
		);

		const parsed = z
			.object({
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
			})
			.safeParse({
				title: formData.get("title"),
				slug: formData.get("slug"),
				description: formData.get("description"),
				status: formData.get("status"),
				category: formData.get("category"),
			});

		if (!parsed.success) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: parsed.error.issues[0]?.message ?? "Validation error",
			});
		}

		let description = parsed.data.description;

		// Replace base64 images with actual media URLs
		if (uploadedMedia.length > 0) {
			// Build a map of base64 prefix to filename
			const base64ToFilename = new Map<string, string>();

			uploadedMedia.forEach((media) => {
				const previewKey = `${media.fieldName}-preview`;
				const preview = formData.get(previewKey) as string;
				if (preview) {
					const base64Prefix = preview.substring(0, 100);
					base64ToFilename.set(base64Prefix, media.filename);
				}
			});
			const $ = cheerio.load(description);
			const images = $("img");

			images.each((_i, img) => {
				const src = $(img).attr("src");
				if (src?.startsWith("data:image")) {
					// Find matching uploaded media by comparing base64 prefix
					const base64Prefix = src.substring(0, 100);
					const filename = base64ToFilename.get(base64Prefix);

					if (filename) {
						// Replace with actual media URL
						const mediaUrl = href("/api/media/file/:filenameOrId", {
							filenameOrId: filename,
						});
						$(img).attr("src", mediaUrl);
					}
				}
			});

			description = $.html();
		}

		// Update course
		const updateResult = await tryUpdateCourse({
			payload,
			courseId,
			data: {
				title: parsed.data.title,
				description,
				status: parsed.data.status,
			},
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			overrideAccess: true,
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
			message: "Course updated successfully",
			id: courseId,
		});
	} catch (error) {
		// Rollback on any error
		await payload.db.rollbackTransaction(transactionID);
		console.error("Course update error:", error);
		return badRequest({
			success: false,
			error: error instanceof Error ? error.message : "Failed to update course",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		if (actionData.status === 200) {
			notifications.show({
				title: "Course updated",
				message: "The course has been updated successfully",
				color: "green",
			});
			// Redirect to the course's view page
			throw redirect(`/course/${actionData.id}`);
		}
	} else if ("error" in actionData) {
		notifications.show({
			title: "Update failed",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

export default function EditCoursePage({ loaderData }: Route.ComponentProps) {
	const fetcher = useFetcher<typeof action>();
	const descriptionId = useId();
	const [description, setDescription] = useState(
		"error" in loaderData ? "" : loaderData.course.description,
	);
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);

	const handleImageAdd = (imageFile: ImageFile) => {
		setImageFiles((prev) => [...prev, imageFile]);
	};

	// Initialize form with default values (hooks must be called unconditionally)
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: "error" in loaderData ? "" : loaderData.course.title,
			slug: "error" in loaderData ? "" : loaderData.course.slug,
			status: ("error" in loaderData
				? "draft"
				: loaderData.course.status) as Course["status"],
			category:
				"error" in loaderData
					? ""
					: loaderData.course.category
						? loaderData.course.category.toString()
						: "",
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
		},
	});

	// Handle error state after all hooks are called
	if ("error" in loaderData) {
		return (
			<Container size="sm" py="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="md" c="red">
						Error
					</Title>
					<p>{loaderData.error}</p>
				</Paper>
			</Container>
		);
	}

	const { categories } = loaderData;

	const handleSubmit = (values: typeof form.values) => {
		// Validate description
		if (!description || description.trim().length === 0) {
			return;
		}

		const formData = new FormData();
		formData.append("title", values.title);
		formData.append("slug", values.slug);
		formData.append("description", description);
		formData.append("status", values.status ?? "draft");

		if (values.category) {
			formData.append("category", values.category);
		}

		// Add each image file with a unique field name
		imageFiles.forEach((imageFile, index) => {
			formData.append(`image-${index}`, imageFile.file);
			formData.append(`image-${index}-preview`, imageFile.preview);
		});

		fetcher.submit(formData, {
			method: "POST",
			encType: "multipart/form-data",
		});
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
							<label
								htmlFor={descriptionId}
								style={{
									display: "block",
									marginBottom: "8px",
									fontWeight: 500,
								}}
							>
								Description *
							</label>
							<div id={descriptionId}>
								<RichTextEditor
									content={description}
									onChange={setDescription}
									onImageAdd={handleImageAdd}
									placeholder="Enter course description"
								/>
							</div>
							{!description && (
								<div
									style={{ color: "red", fontSize: "14px", marginTop: "4px" }}
								>
									Description is required
								</div>
							)}
						</div>

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
							<Button
								type="submit"
								loading={fetcher.state !== "idle"}
								disabled={fetcher.state !== "idle"}
							>
								Update Course
							</Button>
						</Group>
					</Stack>
				</fetcher.Form>
			</Paper>
		</Container>
	);
}
