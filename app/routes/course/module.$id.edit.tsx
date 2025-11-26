import {
	Anchor,
	Button,
	Container,
	Divider,
	Group,
	NumberInput,
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
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCourseModuleSettings } from "server/internal/course-activity-module-link-management";
import type { LatestCourseModuleSettings } from "server/json";
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

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);

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

enum Action {
	UpdatePage = "updatePage",
	UpdateWhiteboard = "updateWhiteboard",
	UpdateFile = "updateFile",
	UpdateAssignment = "updateAssignment",
	UpdateQuiz = "updateQuiz",
	UpdateDiscussion = "updateDiscussion",
}

// Define search params for module settings update
export const moduleSettingsSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(moduleSettingsSearchParams);

const updatePageSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "page",
			name: requestData.name || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const updateWhiteboardSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "whiteboard",
			name: requestData.name || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const updateFileSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "file",
			name: requestData.name || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const updateAssignmentSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
		allowSubmissionsFrom?: string | null;
		dueDate?: string | null;
		cutoffDate?: string | null;
		maxAttempts?: number | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "assignment",
			name: requestData.name || undefined,
			allowSubmissionsFrom: requestData.allowSubmissionsFrom || undefined,
			dueDate: requestData.dueDate || undefined,
			cutoffDate: requestData.cutoffDate || undefined,
			maxAttempts: requestData.maxAttempts || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const updateQuizSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
		openingTime?: string | null;
		closingTime?: string | null;
		maxAttempts?: number | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "quiz",
			name: requestData.name || undefined,
			openingTime: requestData.openingTime || undefined,
			closingTime: requestData.closingTime || undefined,
			maxAttempts: requestData.maxAttempts || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const updateDiscussionSettingsAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
		dueDate?: string | null;
		cutoffDate?: string | null;
	};

	const settings: LatestCourseModuleSettings = {
		version: "v2",
		settings: {
			type: "discussion",
			name: requestData.name || undefined,
			dueDate: requestData.dueDate || undefined,
			cutoffDate: requestData.cutoffDate || undefined,
		},
	};

	const result = await tryUpdateCourseModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		settings,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const getActionUrl = (action: Action, moduleLinkId: string) => {
	return (
		href("/course/module/:moduleLinkId/edit", {
			moduleLinkId,
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
			error: "Action is required",
		});
	}

	if (actionType === Action.UpdatePage) {
		return updatePageSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateWhiteboard) {
		return updateWhiteboardSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateFile) {
		return updateFileSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateAssignment) {
		return updateAssignmentSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateQuiz) {
		return updateQuizSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateDiscussion) {
		return updateDiscussionSettingsAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	return badRequest({
		error: "Invalid action",
	});
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
	assignmentMaxAttempts?: number | null;
	// Quiz fields
	quizOpeningTime?: Date | string | null;
	quizClosingTime?: Date | string | null;
	quizMaxAttempts?: number | null;
	// Discussion fields
	discussionDueDate?: Date | string | null;
	discussionCutoffDate?: Date | string | null;
};

const useUpdateCourseModule = (moduleLinkId: string) => {
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
		const payload: Record<string, string | number | null> = {
			name: values.name || null,
		};

		// Add module-specific fields based on type
		if (values.moduleType === "assignment") {
			payload.allowSubmissionsFrom = toISOStringOrNull(
				values.allowSubmissionsFrom,
			);
			payload.dueDate = toISOStringOrNull(values.assignmentDueDate);
			payload.cutoffDate = toISOStringOrNull(values.assignmentCutoffDate);
			payload.maxAttempts = values.assignmentMaxAttempts || null;
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdateAssignment, moduleLinkId),
				encType: ContentType.JSON,
			});
		} else if (values.moduleType === "quiz") {
			payload.openingTime = toISOStringOrNull(values.quizOpeningTime);
			payload.closingTime = toISOStringOrNull(values.quizClosingTime);
			payload.maxAttempts = values.quizMaxAttempts || null;
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdateQuiz, moduleLinkId),
				encType: ContentType.JSON,
			});
		} else if (values.moduleType === "discussion") {
			payload.dueDate = toISOStringOrNull(values.discussionDueDate);
			payload.cutoffDate = toISOStringOrNull(values.discussionCutoffDate);
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdateDiscussion, moduleLinkId),
				encType: ContentType.JSON,
			});
		} else if (values.moduleType === "page") {
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdatePage, moduleLinkId),
				encType: ContentType.JSON,
			});
		} else if (values.moduleType === "whiteboard") {
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdateWhiteboard, moduleLinkId),
				encType: ContentType.JSON,
			});
		} else if (values.moduleType === "file") {
			fetcher.submit(payload, {
				method: "POST",
				action: getActionUrl(Action.UpdateFile, moduleLinkId),
				encType: ContentType.JSON,
			});
		}
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
	const { updateModule, isLoading } = useUpdateCourseModule(
		String(moduleLinkId),
	);
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
			assignmentMaxAttempts:
				existingSettings?.type === "assignment" &&
				"maxAttempts" in existingSettings &&
				typeof existingSettings.maxAttempts === "number"
					? existingSettings.maxAttempts
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
			quizMaxAttempts:
				existingSettings?.type === "quiz" &&
				"maxAttempts" in existingSettings &&
				typeof existingSettings.maxAttempts === "number"
					? existingSettings.maxAttempts
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

									<NumberInput
										label="Maximum Attempts"
										placeholder="Leave empty for unlimited"
										disabled={isLoading}
										min={1}
										description="Maximum number of submission attempts allowed"
										{...form.getInputProps("assignmentMaxAttempts")}
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

									<NumberInput
										label="Maximum Attempts"
										placeholder="Leave empty for unlimited"
										disabled={isLoading}
										min={1}
										description="Maximum number of attempt attempts allowed"
										{...form.getInputProps("quizMaxAttempts")}
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

							{(module.type === "page" ||
								module.type === "whiteboard" ||
								module.type === "file") && (
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
