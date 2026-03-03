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
import { CourseScheduleManager } from "app/components/course-schedule-manager";
import {
	recurringScheduleItemSchema,
	specificDateItemSchema,
} from "app/utils/schedule-types";
import { href, redirect } from "react-router";
import {
	typeCreateActionRpc,
	createActionMap,
} from "app/utils/router/action-utils";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CategoryTreeNode,
	tryGetCategoryTree,
} from "@paideia/paideia-backend";
import {
	tryAddRecurringSchedule,
	tryAddSpecificDate,
	tryRemoveRecurringSchedule,
	tryRemoveSpecificDate,
	tryUpdateCourse,
} from "@paideia/paideia-backend";

import type { RichTextEditorRef } from "app/components/rich-text/rich-text-editor";
import { RichTextEditor } from "app/components/rich-text/rich-text-editor";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/course.$id.settings";
import { omitBy } from "es-toolkit";
import { z } from "zod";
import { getRouteUrl } from "app/utils/router/search-params-utils";

type Course = Route.ComponentProps["loaderData"]["course"];

enum Action {
	UpdateCourse = "updateCourse",
	AddRecurringSchedule = "addRecurringSchedule",
	AddSpecificDate = "addSpecificDate",
	RemoveRecurringSchedule = "removeRecurringSchedule",
	RemoveSpecificDate = "removeSpecificDate",
}

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/:courseId/settings",
});

const updateCourseRpc = createActionRpc({
	formDataSchema: z.object({
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
	}),
	method: "POST",
	action: Action.UpdateCourse,
});

const updateCourseAction = updateCourseRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		if (!courseContext) {
			return badRequest({
				success: false,
				error: "Invalid course ID",
			});
		}

		const courseId = courseContext.course.id;

		if (!courseContext.permissions.canEdit.allowed) {
			return unauthorized({
				success: false,
				error: "You don't have permission to edit this course",
			});
		}

		// Update course using the internal function
		const updateResult = await tryUpdateCourse({
			payload,
			courseId: Number(courseId),
			data: {
				...formData,
			},
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
	},
);

// Add Recurring Schedule Action
const addRecurringScheduleRpc = createActionRpc({
	formDataSchema: z.object({
		data: recurringScheduleItemSchema,
	}),
	method: "POST",
	action: Action.AddRecurringSchedule,
});

const addRecurringScheduleAction = addRecurringScheduleRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		if (!courseContext) {
			return badRequest({
				success: false,
				error: "Invalid course ID",
			});
		}

		const courseId = courseContext.course.id;

		if (!courseContext.permissions.canEdit.allowed) {
			return unauthorized({
				success: false,
				error: "You don't have permission to edit this course",
			});
		}

		const result = await tryAddRecurringSchedule({
			payload,
			courseId: Number(courseId),
			data: formData.data,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Recurring schedule added successfully",
		});
	},
);

// Add Specific Date Action
const addSpecificDateRpc = createActionRpc({
	formDataSchema: z.object({
		data: specificDateItemSchema,
	}),
	method: "POST",
	action: Action.AddSpecificDate,
});

const addSpecificDateAction = addSpecificDateRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		if (!courseContext) {
			return badRequest({
				success: false,
				error: "Invalid course ID",
			});
		}

		const courseId = courseContext.course.id;

		if (!courseContext.permissions.canEdit.allowed) {
			return unauthorized({
				success: false,
				error: "You don't have permission to edit this course",
			});
		}

		const result = await tryAddSpecificDate({
			payload,
			courseId: Number(courseId),
			data: formData.data,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Specific date added successfully",
		});
	},
);

// Remove Recurring Schedule Action
const removeRecurringScheduleRpc = createActionRpc({
	formDataSchema: z.object({
		index: z.number().int().min(0),
	}),
	method: "POST",
	action: Action.RemoveRecurringSchedule,
});

const removeRecurringScheduleAction = removeRecurringScheduleRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		if (!courseContext) {
			return badRequest({
				success: false,
				error: "Invalid course ID",
			});
		}

		const courseId = courseContext.course.id;

		if (!courseContext.permissions.canEdit.allowed) {
			return unauthorized({
				success: false,
				error: "You don't have permission to edit this course",
			});
		}

		const result = await tryRemoveRecurringSchedule({
			payload,
			courseId: Number(courseId),
			index: formData.index,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Recurring schedule removed successfully",
		});
	},
);

// Remove Specific Date Action
const removeSpecificDateRpc = createActionRpc({
	formDataSchema: z.object({
		index: z.number().int().min(0),
	}),
	method: "POST",
	action: Action.RemoveSpecificDate,
});

const removeSpecificDateAction = removeSpecificDateRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);
		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}
		if (!courseContext) {
			return badRequest({
				success: false,
				error: "Invalid course ID",
			});
		}

		const courseId = courseContext.course.id;

		if (!courseContext.permissions.canEdit.allowed) {
			return unauthorized({
				success: false,
				error: "You don't have permission to edit this course",
			});
		}

		const result = await tryRemoveSpecificDate({
			payload,
			courseId: Number(courseId),
			index: formData.index,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Specific date removed successfully",
		});
	},
);

const useEditCourse = updateCourseRpc.createHook<typeof updateCourseAction>();
const useAddRecurringSchedule =
	addRecurringScheduleRpc.createHook<typeof addRecurringScheduleAction>();
const useAddSpecificDate =
	addSpecificDateRpc.createHook<typeof addSpecificDateAction>();
const useRemoveRecurringSchedule =
	removeRecurringScheduleRpc.createHook<typeof removeRecurringScheduleAction>();
const useRemoveSpecificDate =
	removeSpecificDateRpc.createHook<typeof removeSpecificDateAction>();

// Export hooks for use in component
export {
	useAddRecurringSchedule,
	useAddSpecificDate,
	useEditCourse,
	useRemoveRecurringSchedule,
	useRemoveSpecificDate,
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const { course } = courseContext;

	if (!courseContext.permissions.canEdit.allowed) {
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

	return {
		success: true,
		course: course,
		categories: flatCategories,
	};
});

const [action] = createActionMap({
	[Action.UpdateCourse]: updateCourseAction,
	[Action.AddRecurringSchedule]: addRecurringScheduleAction,
	[Action.AddSpecificDate]: addSpecificDateAction,
	[Action.RemoveRecurringSchedule]: removeRecurringScheduleAction,
	[Action.RemoveSpecificDate]: removeSpecificDateAction,
});

export { action };

export async function clientAction({
	serverAction,
	request,
}: Route.ClientActionArgs) {
	const actionData = await serverAction();
	const url = new URL(request.url);
	const actionParam = url.searchParams.get("action");

	if (!actionData) return;

	if (actionData?.status === StatusCode.Ok) {
		if (actionParam === Action.UpdateCourse) {
			notifications.show({
				title: "Course updated",
				message: actionData.message,
				color: "green",
			});
			// Redirect to the course's view page
			if ("id" in actionData && actionData.id) {
				return redirect(
					href("/course/:courseId", { courseId: String(actionData.id) }),
				);
			}
		} else if (
			actionParam === Action.AddRecurringSchedule ||
			actionParam === Action.AddSpecificDate ||
			actionParam === Action.RemoveRecurringSchedule ||
			actionParam === Action.RemoveSpecificDate
		) {
			notifications.show({
				title: "Success",
				message: actionData.message,
				color: "green",
			});
		}
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Operation failed",
			message: actionData.error,
			color: "red",
		});
	}
	return actionData;
}

// ============================================================================
// THUMBNAIL DROPZONE COMPONENT
// ============================================================================

export interface ThumbnailDropzoneProps {
	form: EditCourseForm;
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

const useEditCourseForm = (
	course: Route.ComponentProps["loaderData"]["course"],
) => {
	// Initialize form with default values (hooks must be called unconditionally)
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: course.title,
			slug: course.slug,
			status: course.status as Course["status"],
			category: course.category?.id ?? null,
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

	return form;
};

type EditCourseForm = ReturnType<typeof useEditCourseForm>;

export default function EditCoursePage({ loaderData }: Route.ComponentProps) {
	const { course, categories } = loaderData;
	const { submit: editCourse, isLoading } = useEditCourse();
	const descriptionId = useId();
	const richTextEditorRef = useRef<RichTextEditorRef>(null);

	const form = useEditCourseForm(course);

	const handleSubmit = async (values: typeof form.values) => {
		if (!form.isDirty()) {
			notifications.show({
				title: "No changes to update",
				message: "Please make changes to the course before updating",
				color: "yellow",
			});
			return;
		}

		// we only want the changed values
		const data = omitBy(
			values,
			(value, key) => form.getInitialValues()[key] === value,
		);

		await editCourse({
			values: data,
			params: { courseId: course.id },
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

				<form onSubmit={form.onSubmit(handleSubmit)}>
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
							initialPreviewUrl={
								course.thumbnail
									? getRouteUrl("/api/media/file/:mediaId", {
											params: { mediaId: course.thumbnail.id.toString() },
											searchParams: {},
										})
									: null
							}
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
				</form>
			</Paper>

			{/* Schedule Section */}
			<Paper withBorder shadow="md" p="xl" radius="md" mt="xl">
				<CourseScheduleManager
					courseId={course.id}
					recurringSchedules={
						(
							course as unknown as {
								recurringSchedules?: Array<{
									daysOfWeek?: Array<{ day?: number }>;
									startTime?: string;
									endTime?: string;
									startDate?: string | Date;
									endDate?: string | Date;
								}>;
							}
						).recurringSchedules ?? null
					}
					specificDates={
						(
							course as unknown as {
								specificDates?: Array<{
									date?: string | Date;
									startTime?: string;
									endTime?: string;
								}>;
							}
						).specificDates ?? null
					}
				/>
			</Paper>
		</Container>
	);
}
