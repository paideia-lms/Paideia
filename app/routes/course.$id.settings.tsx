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
import { useId, useRef, useState } from "react";
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

import type { Course } from "server/payload-types";
import type { UseFormReturnType } from "@mantine/form";
import { canSeeCourseSettings } from "server/utils/permissions";
import type { RichTextEditorRef } from "~/components/rich-text-editor";
import { RichTextEditor } from "~/components/rich-text-editor";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/course.$id.settings";
import { ContentType } from "app/utils/get-content-type";
import { convertMyFormDataToObject, MyFormData } from "~/utils/action-utils";
import { isUndefined, omitBy } from "es-toolkit";
import { z } from "zod";

export const actionInputSchema = z.looseObject({
	title: z.string().min(1, "Title is required").optional(),
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		)
		.optional(),
	thumbnail: z.file().nullish(),
	description: z.string().min(1, "Description is required").optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	category: z.coerce.number().nullish(),
	redirectTo: z
		.union([z.string(), z.null()])
		.optional()
		.refine(
			(val) => {
				// Allow null/undefined
				if (!val) return true;
				// Must be a relative path (starts with /) and not an absolute URL
				return (
					val.startsWith("/") &&
					!val.startsWith("http://") &&
					!val.startsWith("https://") &&
					!val.startsWith("//")
				);
			},
			{
				message:
					"Redirect path must be a relative path starting with '/' and cannot be an absolute URL",
			},
		),
});

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
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
		req: payloadRequest,
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
		? String(course.thumbnail.id)
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

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrollmentContext = context.get(enrolmentContextKey);
	const { courseId: _courseId } = params;
	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	const courseId = Number.isNaN(_courseId) ? null : Number(_courseId);

	if (!courseId) {
		return badRequest({
			success: false,
			error: "Invalid course ID",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Check if user has permission to edit settings
	const canEdit = canSeeCourseSettings(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrollmentContext?.enrolment,
	);

	if (!canEdit) {
		return unauthorized({
			success: false,
			error: "You don't have permission to edit this course",
		});
	}

	// Get form data and convert to object
	const formDataObj = convertMyFormDataToObject<ActionData>(
		await request.formData(),
	);

	const parse = actionInputSchema.safeParse(formDataObj);

	if (!parse.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parse.error),
		});
	}

	// Prepare data for tryupdateCourseWithFile
	const parsedData = parse.data;

	// Update course using the internal function
	const updateResult = await tryUpdateCourse({
		payload,
		courseId: Number(courseId),
		data: parsedData,
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
		message: "Course updated successfully",
		id: courseId,
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
		// Redirect to the course's view page
		return redirect(
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

type ActionData = {
	title?: string;
	slug?: string;
	description?: string;
	status?: "draft" | "published" | "archived" | undefined;
	category?: string | null;
	thumbnail?: File | null;
	redirectTo?: string;
};

// ============================================================================
// THUMBNAIL DROPZONE COMPONENT
// ============================================================================

export interface ThumbnailDropzoneProps {
	form: UseFormReturnType<{
		title: string;
		slug: string;
		status: Course["status"];
		category: string;
		description: string;
		thumbnail: File | null;
	}>;
	initialPreviewUrl?: string | null;
}

export function ThumbnailDropzone({
	form,
	initialPreviewUrl,
}: ThumbnailDropzoneProps) {
	const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
		initialPreviewUrl ?? null,
	);

	const handleThumbnailDrop = (files: File[]) => {
		const file = files[0];
		if (file) {
			form.setFieldValue("thumbnail", file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setThumbnailPreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	return (
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
	);
}

export function useEditCourse() {
	const fetcher = useFetcher<typeof action>();
	const editCourse = async (courseId: number, data: ActionData) => {
		const finalData = omitBy(data, isUndefined);
		const formData = new MyFormData(finalData);

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/:courseId/settings", {
				courseId: String(courseId),
			}),
			encType: ContentType.MULTIPART,
		});
	};
	return { editCourse, isLoading: fetcher.state !== "idle", fetcher };
}

export default function EditCoursePage({ loaderData }: Route.ComponentProps) {
	const { course, categories } = loaderData;
	const { editCourse, isLoading, fetcher } = useEditCourse();
	const descriptionId = useId();
	const richTextEditorRef = useRef<RichTextEditorRef>(null);

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
			thumbnail: null as File | null,
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

	const handleSubmit = async (values: typeof form.values) => {
		if (!form.isDirty()) {
			notifications.show({
				title: "No changes to update",
				message: "Please make changes to the course before updating",
				color: "yellow",
			});
			return;
		}

		// Build the data object
		const data: ActionData = omitBy(
			values,
			(value, key) => form.getInitialValues()[key] === value,
		);

		await editCourse(course.id, data);
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

						<ThumbnailDropzone
							form={form}
							initialPreviewUrl={course.thumbnailUrl}
						/>

						<Input.Wrapper label="Description" required>
							<div id={descriptionId}>
								<RichTextEditor
									ref={richTextEditorRef}
									content={form.getValues().description}
									onChange={(v) => form.setFieldValue("description", v)}
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
