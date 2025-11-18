import {
	Anchor,
	Button,
	Container,
	Divider,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCourseModuleSettings } from "server/internal/course-activity-module-link-management";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
import { useDeleteModuleLink } from "~/routes/course.$id.modules";
import { assertRequestMethod } from "~/utils/assert-request-method";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id.edit";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Check if user can edit
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;
	const canEdit =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		courseContext.course.enrollments.some(
			(enrollment: { userId: number; role: string }) =>
				enrollment.userId === currentUser.id &&
				(enrollment.role === "teacher" || enrollment.role === "ta"),
		);

	if (!canEdit) {
		throw new ForbiddenResponse(
			"You don't have permission to edit this module",
		);
	}

	return {
		course: courseContext.course,
		module: courseModuleContext.module,
		moduleLinkId: courseModuleContext.moduleLinkId,
		settings: courseModuleContext.moduleLinkSettings,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		moduleType: string;
		name?: string | null;
		allowSubmissionsFrom?: string | null;
		dueDate?: string | null;
		cutoffDate?: string | null;
		openingTime?: string | null;
		closingTime?: string | null;
	};

	if (!requestData.moduleType) {
		return badRequest({ error: "Module type is required" });
	}

	const { moduleType, name, ...dateFields } = requestData;

	// Build settings based on module type
	let settings: CourseModuleSettingsV1;

	switch (moduleType) {
		case "page":
		case "whiteboard":
			settings = {
				version: "v1",
				settings: {
					type: moduleType,
					name: name || undefined,
				},
			};
			break;

		case "assignment": {
			settings = {
				version: "v1",
				settings: {
					type: "assignment",
					name: name || undefined,
					allowSubmissionsFrom: dateFields.allowSubmissionsFrom || undefined,
					dueDate: dateFields.dueDate || undefined,
					cutoffDate: dateFields.cutoffDate || undefined,
				},
			};
			break;
		}

		case "quiz": {
			settings = {
				version: "v1",
				settings: {
					type: "quiz",
					name: name || undefined,
					openingTime: dateFields.openingTime || undefined,
					closingTime: dateFields.closingTime || undefined,
				},
			};
			break;
		}

		case "discussion": {
			settings = {
				version: "v1",
				settings: {
					type: "discussion",
					name: name || undefined,
					dueDate: dateFields.dueDate || undefined,
					cutoffDate: dateFields.cutoffDate || undefined,
				},
			};
			break;
		}

		default:
			return badRequest({ error: "Invalid module type" });
	}

	// Update the settings
	const result = await tryUpdateCourseModuleSettings(
		payload,
		request,
		Number(moduleLinkId),
		settings,
	);

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	// Redirect to the module page
	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: "Failed to update module settings",
			color: "red",
		});
	}

	return actionData;
}

type UpdateModuleValues = {
	moduleType: string;
	name?: string;
	// Assignment fields
	allowSubmissionsFrom?: Date | string | null;
	assignmentDueDate?: Date | string | null;
	assignmentCutoffDate?: Date | string | null;
	// Quiz fields
	quizOpeningTime?: Date | string | null;
	quizClosingTime?: Date | string | null;
	// Discussion fields
	discussionDueDate?: Date | string | null;
	discussionCutoffDate?: Date | string | null;
};

const useUpdateCourseModule = () => {
	const fetcher = useFetcher<typeof action>();

	const toISOStringOrNull = (
		value: Date | string | null | undefined,
	): string | null => {
		if (!value) return null;
		if (value instanceof Date) return value.toISOString();
		if (typeof value === "string") return value;
		return null;
	};

	const updateModule = (values: UpdateModuleValues) => {
		const payload: Record<string, string | null> = {
			moduleType: values.moduleType,
			name: values.name || null,
		};

		// Add module-specific fields
		if (values.moduleType === "assignment") {
			payload.allowSubmissionsFrom = toISOStringOrNull(
				values.allowSubmissionsFrom,
			);
			payload.dueDate = toISOStringOrNull(values.assignmentDueDate);
			payload.cutoffDate = toISOStringOrNull(values.assignmentCutoffDate);
		} else if (values.moduleType === "quiz") {
			payload.openingTime = toISOStringOrNull(values.quizOpeningTime);
			payload.closingTime = toISOStringOrNull(values.quizClosingTime);
		} else if (values.moduleType === "discussion") {
			payload.dueDate = toISOStringOrNull(values.discussionDueDate);
			payload.cutoffDate = toISOStringOrNull(values.discussionCutoffDate);
		}

		fetcher.submit(payload, {
			method: "POST",
			encType: ContentType.JSON,
		});
	};

	return {
		updateModule,
		isLoading: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export default function ModuleEditPage({ loaderData }: Route.ComponentProps) {
	const { course, module, moduleLinkId, settings } = loaderData;
	const navigate = useNavigate();
	const { updateModule, isLoading } = useUpdateCourseModule();
	const { deleteModuleLink, isLoading: isDeleting } = useDeleteModuleLink();

	// Parse existing settings
	const existingSettings = settings?.settings;

	// Use custom name if available, otherwise use module title
	const displayName = existingSettings?.name ?? module.title;

	// Initialize form with existing values
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			moduleType: module.type,
			name: existingSettings?.name || "",
			// Assignment fields
			allowSubmissionsFrom:
				existingSettings?.type === "assignment" &&
				existingSettings.allowSubmissionsFrom
					? new Date(existingSettings.allowSubmissionsFrom)
					: null,
			assignmentDueDate:
				existingSettings?.type === "assignment" && existingSettings.dueDate
					? new Date(existingSettings.dueDate)
					: null,
			assignmentCutoffDate:
				existingSettings?.type === "assignment" && existingSettings.cutoffDate
					? new Date(existingSettings.cutoffDate)
					: null,
			// Quiz fields
			quizOpeningTime:
				existingSettings?.type === "quiz" && existingSettings.openingTime
					? new Date(existingSettings.openingTime)
					: null,
			quizClosingTime:
				existingSettings?.type === "quiz" && existingSettings.closingTime
					? new Date(existingSettings.closingTime)
					: null,
			// Discussion fields
			discussionDueDate:
				existingSettings?.type === "discussion" && existingSettings.dueDate
					? new Date(existingSettings.dueDate)
					: null,
			discussionCutoffDate:
				existingSettings?.type === "discussion" && existingSettings.cutoffDate
					? new Date(existingSettings.cutoffDate)
					: null,
		},
	});

	const handleSubmit = (values: typeof form.values) => {
		updateModule(values);
	};

	const handleDelete = () => {
		modals.openConfirmModal({
			title: "Remove Module from Course",
			children: (
				<Text size="sm">
					Are you sure you want to remove this module from the course? This
					action cannot be undone. This will only remove the link between the
					module and the course, not delete the module itself.
				</Text>
			),
			labels: { confirm: "Remove", cancel: "Cancel" },
			confirmProps: { color: "red" },
			onConfirm: () => {
				deleteModuleLink(
					moduleLinkId,
					course.id,
					href("/course/:courseId", { courseId: String(course.id) }),
				);
			},
		});
	};

	const title = `Edit Module Settings | ${displayName} | ${course.title} | Paideia LMS`;

	return (
		<Container size="md" py="xl">
			<title>{title}</title>
			<meta name="description" content="Edit course module settings" />
			<meta property="og:title" content={title} />
			<meta property="og:description" content="Edit course module settings" />

			<Stack gap="xl">
				<Group justify="space-between" align="center">
					<Text size="sm" c="dimmed">
						Editing course-specific settings for this module.
						<Anchor
							href={href("/user/module/edit/:moduleId", {
								moduleId: module.id.toString(),
							})}
							ml="xs"
						>
							Edit module content →
						</Anchor>
					</Text>
				</Group>

				<Paper shadow="sm" p="xl" withBorder>
					<form onSubmit={form.onSubmit(handleSubmit)}>
						<Stack gap="md">
							<TextInput
								label="Custom Module Name"
								placeholder="Leave empty to use default module name"
								disabled={isLoading}
								description="Override the module name for this course"
								{...form.getInputProps("name")}
							/>

							{module.type === "assignment" && (
								<>
									<DateTimePicker
										label="Allow Submissions From"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="When students can start submitting"
										{...form.getInputProps("allowSubmissionsFrom")}
									/>

									<DateTimePicker
										label="Due Date"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="Assignment due date"
										{...form.getInputProps("assignmentDueDate")}
									/>

									<DateTimePicker
										label="Cutoff Date"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="Latest possible submission time"
										{...form.getInputProps("assignmentCutoffDate")}
									/>
								</>
							)}

							{module.type === "quiz" && (
								<>
									<DateTimePicker
										label="Opening Time"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="When quiz becomes available"
										{...form.getInputProps("quizOpeningTime")}
									/>

									<DateTimePicker
										label="Closing Time"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="When quiz closes"
										{...form.getInputProps("quizClosingTime")}
									/>
								</>
							)}

							{module.type === "discussion" && (
								<>
									<DateTimePicker
										label="Due Date"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="Discussion due date"
										{...form.getInputProps("discussionDueDate")}
									/>

									<DateTimePicker
										label="Cutoff Date"
										placeholder="Select date and time"
										disabled={isLoading}
										clearable
										description="Discussion cutoff date"
										{...form.getInputProps("discussionCutoffDate")}
									/>
								</>
							)}

							{(module.type === "page" || module.type === "whiteboard") && (
								<Text c="dimmed" size="sm">
									Only custom name can be configured for {module.type} modules.
								</Text>
							)}

							<Group justify="flex-end" mt="md">
								<Button
									variant="subtle"
									onClick={() =>
										navigate(
											href("/course/module/:moduleLinkId", {
												moduleLinkId: String(moduleLinkId),
											}),
										)
									}
									disabled={isLoading}
								>
									Cancel
								</Button>
								<Button type="submit" loading={isLoading}>
									Save Settings
								</Button>
							</Group>
						</Stack>
					</form>
				</Paper>

				{/* Danger Zone */}
				<Paper
					withBorder
					shadow="sm"
					p="xl"
					style={{ borderColor: "var(--mantine-color-red-6)" }}
				>
					<Stack gap="md">
						<div>
							<Title order={3} c="red">
								Danger Zone
							</Title>
							<Text size="sm" c="dimmed" mt="xs">
								Irreversible and destructive actions
							</Text>
						</div>

						<Divider color="red" />

						<Group justify="space-between" align="flex-start">
							<div style={{ flex: 1 }}>
								<Text fw={500} mb="xs">
									Remove module from course
								</Text>
								<Text size="sm" c="dimmed">
									Once you remove this module from the course, there is no going
									back. This will only remove the link between the module and
									the course, not delete the module itself.
								</Text>
							</div>
							<Button
								color="red"
								variant="light"
								leftSection={<IconTrash size={16} />}
								onClick={handleDelete}
								loading={isDeleting}
								style={{ minWidth: "150px" }}
							>
								Remove Module
							</Button>
						</Group>
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
