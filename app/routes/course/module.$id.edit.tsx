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
	parseAsStringEnum,
} from "nuqs/server";
import { href, redirect, useNavigate } from "react-router";
import { typeCreateActionRpc, createActionMap } from "~/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { z } from "zod";
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
import {
	badRequest,
	ForbiddenResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id.edit";
import { enrolmentContextKey } from "server/contexts/enrolment-context";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context }) => {
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
})!;

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
	action: parseAsStringEnum(Object.values(Action)),
};

export const loadSearchParams = createLoader(moduleSettingsSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/module/:moduleLinkId/edit",
});

const updatePageSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
	}),
	method: "POST",
	action: Action.UpdatePage,
});

const updateWhiteboardSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
	}),
	method: "POST",
	action: Action.UpdateWhiteboard,
});

const updateFileSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
	}),
	method: "POST",
	action: Action.UpdateFile,
});

const updateAssignmentSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
		allowSubmissionsFrom: z.string().nullish(),
		dueDate: z.string().nullish(),
		cutoffDate: z.string().nullish(),
		maxAttempts: z.coerce.number().nullish(),
	}),
	method: "POST",
	action: Action.UpdateAssignment,
});

const updateQuizSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
		openingTime: z.string().nullish(),
		closingTime: z.string().nullish(),
		maxAttempts: z.coerce.number().nullish(),
	}),
	method: "POST",
	action: Action.UpdateQuiz,
});

const updateDiscussionSettingsRpc = createActionRpc({
	formDataSchema: z.object({
		name: z.string().nullish(),
		dueDate: z.string().nullish(),
		cutoffDate: z.string().nullish(),
	}),
	method: "POST",
	action: Action.UpdateDiscussion,
});

const updatePageSettingsAction = updatePageSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdatePageModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
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
	},
);

const useUpdatePageSettings =
	updatePageSettingsRpc.createHook<typeof updatePageSettingsAction>();

const updateWhiteboardSettingsAction = updateWhiteboardSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdateWhiteboardModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
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
	},
);

const useUpdateWhiteboardSettings =
	updateWhiteboardSettingsRpc.createHook<typeof updateWhiteboardSettingsAction>();

const updateFileSettingsAction = updateFileSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdateFileModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
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
	},
);

const useUpdateFileSettings =
	updateFileSettingsRpc.createHook<typeof updateFileSettingsAction>();

const updateAssignmentSettingsAction = updateAssignmentSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdateAssignmentModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
			allowSubmissionsFrom: formData.allowSubmissionsFrom || undefined,
			dueDate: formData.dueDate || undefined,
			cutoffDate: formData.cutoffDate || undefined,
			maxAttempts: formData.maxAttempts || undefined,
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
	},
);

const useUpdateAssignmentSettings =
	updateAssignmentSettingsRpc.createHook<typeof updateAssignmentSettingsAction>();

const updateQuizSettingsAction = updateQuizSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdateQuizModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
			openingTime: formData.openingTime || undefined,
			closingTime: formData.closingTime || undefined,
			maxAttempts: formData.maxAttempts || undefined,
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
	},
);

const useUpdateQuizSettings =
	updateQuizSettingsRpc.createHook<typeof updateQuizSettingsAction>();

const updateDiscussionSettingsAction = updateDiscussionSettingsRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const result = await tryUpdateDiscussionModuleSettings({
			payload,
			linkId: Number(moduleLinkId),
			name: formData.name || undefined,
			dueDate: formData.dueDate || undefined,
			cutoffDate: formData.cutoffDate || undefined,
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
	},
);

const useUpdateDiscussionSettings =
	updateDiscussionSettingsRpc.createHook<typeof updateDiscussionSettingsAction>();

// Export hooks for use in components
export {
	useUpdatePageSettings,
	useUpdateWhiteboardSettings,
	useUpdateFileSettings,
	useUpdateAssignmentSettings,
	useUpdateQuizSettings,
	useUpdateDiscussionSettings,
};

const [action] = createActionMap({
	[Action.UpdatePage]: updatePageSettingsAction,
	[Action.UpdateWhiteboard]: updateWhiteboardSettingsAction,
	[Action.UpdateFile]: updateFileSettingsAction,
	[Action.UpdateAssignment]: updateAssignmentSettingsAction,
	[Action.UpdateQuiz]: updateQuizSettingsAction,
	[Action.UpdateDiscussion]: updateDiscussionSettingsAction,
});

export { action };

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

// Helper function to convert Date to ISO string or null
const toISOStringOrNull = (
	value: Date | string | null | undefined,
): string | null => {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return null;
};

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
	const { submit: updatePageSettings, isLoading } = useUpdatePageSettings();
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit(async (values) => {
				await updatePageSettings({
					values: {
						name: values.name || null,
					},
					params: { moduleLinkId },
				});
			})}
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
	const { submit: updateWhiteboardSettings, isLoading } =
		useUpdateWhiteboardSettings();
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit(async (values) => {
				await updateWhiteboardSettings({
					values: {
						name: values.name || null,
					},
					params: { moduleLinkId },
				});
			})}
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
	const { submit: updateFileSettings, isLoading } = useUpdateFileSettings();
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			name: settings?.name ?? "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit(async (values) => {
				await updateFileSettings({
					values: {
						name: values.name || null,
					},
					params: { moduleLinkId },
				});
			})}
		>
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
	const { submit: updateAssignmentSettings, isLoading } =
		useUpdateAssignmentSettings();
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
			onSubmit={form.onSubmit(async (values) => {
				await updateAssignmentSettings({
					values: {
						name: values.name || null,
						allowSubmissionsFrom: toISOStringOrNull(
							values.allowSubmissionsFrom,
						),
						dueDate: toISOStringOrNull(values.dueDate),
						cutoffDate: toISOStringOrNull(values.cutoffDate),
						maxAttempts: values.maxAttempts || null,
					},
					params: { moduleLinkId },
				});
			})}
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
	const { submit: updateQuizSettings, isLoading } = useUpdateQuizSettings();
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
			onSubmit={form.onSubmit(async (values) => {
				await updateQuizSettings({
					values: {
						name: values.name || null,
						openingTime: toISOStringOrNull(values.openingTime),
						closingTime: toISOStringOrNull(values.closingTime),
						maxAttempts: values.maxAttempts || null,
					},
					params: { moduleLinkId },
				});
			})}
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
	const { submit: updateDiscussionSettings, isLoading } =
		useUpdateDiscussionSettings();
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
			onSubmit={form.onSubmit(async (values) => {
				await updateDiscussionSettings({
					values: {
						name: values.name || null,
						dueDate: toISOStringOrNull(values.dueDate),
						cutoffDate: toISOStringOrNull(values.cutoffDate),
					},
					params: { moduleLinkId },
				});
			})}
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
	const { submit: deleteModuleLink, isLoading: isDeleting } =
		useDeleteModuleLink();

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
			onConfirm: async () => {
				await deleteModuleLink({
					values: {
						linkId: moduleLinkId,
						redirectTo: href("/course/:courseId", {
							courseId: String(courseId),
						}),
					},
					params: { courseId },
				});
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
