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
import {
	tryUpdateAssignmentModuleSettings,
	tryUpdateDiscussionModuleSettings,
	tryUpdateFileModuleSettings,
	tryUpdatePageModuleSettings,
	tryUpdateQuizModuleSettings,
	tryUpdateWhiteboardModuleSettings,
} from "server/internal/course-activity-module-link-management";
import type {
	LatestAssignmentSettings,
	LatestDiscussionSettings,
	LatestFileSettings,
	LatestPageSettings,
	LatestQuizSettings,
	LatestWhiteboardSettings,
} from "server/json";
import { permissions } from "server/utils/permissions";
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
import { enrolmentContextKey } from "server/contexts/enrolment-context";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

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
	const canEdit = permissions.course.module.canEdit(
		currentUser,
		enrolmentContext?.enrolment
			? [
				{
					userId: enrolmentContext.enrolment.user.id,
					role: enrolmentContext.enrolment.role,
				},
			]
			: undefined,
	);

	if (!canEdit.allowed) {
		throw new ForbiddenResponse(canEdit.reason);
	}

	// Use custom name if available, otherwise use module title
	const displayName =
		courseModuleContext.settings?.name ??
		courseModuleContext.activityModule.title;

	return {
		course: courseContext.course,
		module: courseModuleContext,
		displayName,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdatePage } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}


	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
	};

	const result = await tryUpdatePageModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
		req: payloadRequest,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdateWhiteboard } }) => {
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

	const result = await tryUpdateWhiteboardModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdateFile } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { moduleLinkId } = params;

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const requestData = data as {
		name?: string | null;
	};

	const result = await tryUpdateFileModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
		req: payloadRequest,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdateAssignment } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload, payloadRequest } = context.get(globalContextKey);
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

	const result = await tryUpdateAssignmentModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
		allowSubmissionsFrom: requestData.allowSubmissionsFrom || undefined,
		dueDate: requestData.dueDate || undefined,
		cutoffDate: requestData.cutoffDate || undefined,
		maxAttempts: requestData.maxAttempts || undefined,
		req: payloadRequest,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdateQuiz } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload, payloadRequest } = context.get(globalContextKey);
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

	const result = await tryUpdateQuizModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
		openingTime: requestData.openingTime || undefined,
		closingTime: requestData.closingTime || undefined,
		maxAttempts: requestData.maxAttempts || undefined,
		req: payloadRequest,
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
}: Route.ActionArgs & { searchParams: { action: Action.UpdateDiscussion } }) => {
	assertRequestMethod(request.method, "POST");

	const { payload, payloadRequest } = context.get(globalContextKey);
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

	const result = await tryUpdateDiscussionModuleSettings({
		payload,
		linkId: Number(moduleLinkId),
		name: requestData.name || undefined,
		dueDate: requestData.dueDate || undefined,
		cutoffDate: requestData.cutoffDate || undefined,
		req: payloadRequest,
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

// Custom hooks for updating module settings
function useUpdatePageSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const updatePageSettings = (name?: string | null) => {
		fetcher.submit(
			{ name: name || null },
			{
				method: "POST",
				action: getActionUrl(Action.UpdatePage, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updatePageSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useUpdateWhiteboardSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const updateWhiteboardSettings = (name?: string | null) => {
		fetcher.submit(
			{ name: name || null },
			{
				method: "POST",
				action: getActionUrl(Action.UpdateWhiteboard, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updateWhiteboardSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useUpdateFileSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const updateFileSettings = (name?: string | null) => {
		fetcher.submit(
			{ name: name || null },
			{
				method: "POST",
				action: getActionUrl(Action.UpdateFile, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updateFileSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useUpdateAssignmentSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const toISOStringOrNull = (
		value: Date | string | null | undefined,
	): string | null => {
		if (!value) return null;
		if (value instanceof Date) return value.toISOString();
		if (typeof value === "string") return value;
		return null;
	};

	const updateAssignmentSettings = (values: {
		name?: string | null;
		allowSubmissionsFrom?: Date | string | null;
		dueDate?: Date | string | null;
		cutoffDate?: Date | string | null;
		maxAttempts?: number | null;
	}) => {
		fetcher.submit(
			{
				name: values.name || null,
				allowSubmissionsFrom: toISOStringOrNull(values.allowSubmissionsFrom),
				dueDate: toISOStringOrNull(values.dueDate),
				cutoffDate: toISOStringOrNull(values.cutoffDate),
				maxAttempts: values.maxAttempts || null,
			},
			{
				method: "POST",
				action: getActionUrl(Action.UpdateAssignment, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updateAssignmentSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useUpdateQuizSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const toISOStringOrNull = (
		value: Date | string | null | undefined,
	): string | null => {
		if (!value) return null;
		if (value instanceof Date) return value.toISOString();
		if (typeof value === "string") return value;
		return null;
	};

	const updateQuizSettings = (values: {
		name?: string | null;
		openingTime?: Date | string | null;
		closingTime?: Date | string | null;
		maxAttempts?: number | null;
	}) => {
		fetcher.submit(
			{
				name: values.name || null,
				openingTime: toISOStringOrNull(values.openingTime),
				closingTime: toISOStringOrNull(values.closingTime),
				maxAttempts: values.maxAttempts || null,
			},
			{
				method: "POST",
				action: getActionUrl(Action.UpdateQuiz, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updateQuizSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function useUpdateDiscussionSettings(moduleLinkId: string) {
	const fetcher = useFetcher<typeof action>();

	const toISOStringOrNull = (
		value: Date | string | null | undefined,
	): string | null => {
		if (!value) return null;
		if (value instanceof Date) return value.toISOString();
		if (typeof value === "string") return value;
		return null;
	};

	const updateDiscussionSettings = (values: {
		name?: string | null;
		dueDate?: Date | string | null;
		cutoffDate?: Date | string | null;
	}) => {
		fetcher.submit(
			{
				name: values.name || null,
				dueDate: toISOStringOrNull(values.dueDate),
				cutoffDate: toISOStringOrNull(values.cutoffDate),
			},
			{
				method: "POST",
				action: getActionUrl(Action.UpdateDiscussion, moduleLinkId),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updateDiscussionSettings,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// Form wrappers that use their respective hooks
function PageSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestPageSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updatePageSettings, isLoading } = useUpdatePageSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form onSubmit={form.onSubmit((values) => updatePageSettings(values.name))}>
			<Stack gap="md">
				<TextInput
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
					{...form.getInputProps("name")}
				/>

				<Text c="dimmed" size="sm">
					Only custom name can be configured for page modules.
				</Text>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function WhiteboardSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestWhiteboardSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updateWhiteboardSettings, isLoading } = useUpdateWhiteboardSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) =>
				updateWhiteboardSettings(values.name),
			)}
		>
			<Stack gap="md">
				<TextInput
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
					{...form.getInputProps("name")}
				/>

				<Text c="dimmed" size="sm">
					Only custom name can be configured for whiteboard modules.
				</Text>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function FileSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestFileSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updateFileSettings, isLoading } = useUpdateFileSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form onSubmit={form.onSubmit((values) => updateFileSettings(values.name))}>
			<Stack gap="md">
				<TextInput
					{...form.getInputProps("name")}
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
				/>

				<Text c="dimmed" size="sm">
					Only custom name can be configured for file modules.
				</Text>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function AssignmentSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestAssignmentSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updateAssignmentSettings, isLoading } = useUpdateAssignmentSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
			allowSubmissionsFrom: settings?.allowSubmissionsFrom
				? new Date(settings.allowSubmissionsFrom)
				: null,
			dueDate: settings?.dueDate ? new Date(settings.dueDate) : null,
			cutoffDate: settings?.cutoffDate ? new Date(settings.cutoffDate) : null,
			maxAttempts: settings?.maxAttempts || null,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) =>
				updateAssignmentSettings({
					name: values.name,
					allowSubmissionsFrom: values.allowSubmissionsFrom,
					dueDate: values.dueDate,
					cutoffDate: values.cutoffDate,
					maxAttempts: values.maxAttempts,
				}),
			)}
		>
			<Stack gap="md">
				<TextInput
					{...form.getInputProps("name")}
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
				/>

				<DateTimePicker
					{...form.getInputProps("allowSubmissionsFrom")}
					label="Allow Submissions From"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="When students can start submitting"
				/>

				<DateTimePicker
					{...form.getInputProps("dueDate")}
					label="Due Date"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="Assignment due date"
				/>

				<DateTimePicker
					{...form.getInputProps("cutoffDate")}
					label="Cutoff Date"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="Latest possible submission time"
				/>

				<NumberInput
					{...form.getInputProps("maxAttempts")}
					label="Maximum Attempts"
					placeholder="Leave empty for unlimited"
					disabled={isLoading}
					min={1}
					description="Maximum number of submission attempts allowed"
				/>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function QuizSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestQuizSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updateQuizSettings, isLoading } = useUpdateQuizSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
			openingTime: settings?.openingTime
				? new Date(settings.openingTime)
				: null,
			closingTime: settings?.closingTime
				? new Date(settings.closingTime)
				: null,
			maxAttempts: settings?.maxAttempts || null,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) =>
				updateQuizSettings({
					name: values.name,
					openingTime: values.openingTime,
					closingTime: values.closingTime,
					maxAttempts: values.maxAttempts,
				}),
			)}
		>
			<Stack gap="md">
				<TextInput
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
					{...form.getInputProps("name")}
				/>

				<DateTimePicker
					label="Opening Time"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="When quiz becomes available"
					{...form.getInputProps("openingTime")}
				/>

				<DateTimePicker
					label="Closing Time"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="When quiz closes"
					{...form.getInputProps("closingTime")}
				/>

				<NumberInput
					label="Maximum Attempts"
					placeholder="Leave empty for unlimited"
					disabled={isLoading}
					min={1}
					description="Maximum number of attempt attempts allowed"
					{...form.getInputProps("maxAttempts")}
				/>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function DiscussionSettingsFormWrapper({
	settings,
	moduleLinkId,
	onCancel,
}: {
	settings: LatestDiscussionSettings | null;
	moduleLinkId: number;
	onCancel: () => void;
}) {
	const { updateDiscussionSettings, isLoading } = useUpdateDiscussionSettings(
		String(moduleLinkId),
	);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
			dueDate: settings?.dueDate ? new Date(settings.dueDate) : null,
			cutoffDate: settings?.cutoffDate ? new Date(settings.cutoffDate) : null,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) =>
				updateDiscussionSettings({
					name: values.name,
					dueDate: values.dueDate,
					cutoffDate: values.cutoffDate,
				}),
			)}
		>
			<Stack gap="md">
				<TextInput
					label="Custom Module Name"
					placeholder="Leave empty to use default module name"
					disabled={isLoading}
					description="Override the module name for this course"
					{...form.getInputProps("name")}
				/>

				<DateTimePicker
					label="Due Date"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="Discussion due date"
					{...form.getInputProps("dueDate")}
				/>

				<DateTimePicker
					label="Cutoff Date"
					placeholder="Select date and time"
					disabled={isLoading}
					clearable
					description="Discussion cutoff date"
					{...form.getInputProps("cutoffDate")}
				/>

				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Settings
					</Button>
				</Group>
			</Stack>
		</form>
	);
}

function DangerZone({
	moduleLinkId,
	courseId,
}: {
	moduleLinkId: number;
	courseId: number;
}) {
	const { deleteModuleLink, isLoading: isDeleting } = useDeleteModuleLink();

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
					courseId,
					href("/course/:courseId", { courseId: String(courseId) }),
				);
			},
		});
	};

	return (
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
							back. This will only remove the link between the module and the
							course, not delete the module itself.
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
	);
}

export default function ModuleEditPage({ loaderData }: Route.ComponentProps) {
	const { course, module, displayName } = loaderData;
	const navigate = useNavigate();

	const handleCancel = () => {
		navigate(
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(module.id),
			}),
		);
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
					{/* TODO: we should not check two value but for now the type is not right */}
					{module.type === "page" && (
						<PageSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
					{module.type === "whiteboard" && (
						<WhiteboardSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
					{module.type === "file" && (
						<FileSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
					{module.type === "assignment" && (
						<AssignmentSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
					{module.type === "quiz" && (
						<QuizSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
					{module.type === "discussion" && (
						<DiscussionSettingsFormWrapper
							settings={module.settings}
							moduleLinkId={module.id}
							onCancel={handleCancel}
						/>
					)}
				</Paper>

				<DangerZone moduleLinkId={module.id} courseId={course.id} />
			</Stack>
		</Container>
	);
}
