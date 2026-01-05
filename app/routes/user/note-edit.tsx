import { Button, Checkbox, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryFindNoteById,
	tryUpdateNote,
} from "server/internal/note-management";
import { permissions } from "server/utils/permissions";
import { FormableRichTextEditor } from "app/components/form-components/formable-rich-text-editor";
import { badRequest, NotFoundResponse, StatusCode } from "~/utils/responses";
import type { Route } from "./+types/note-edit";
import { z } from "zod";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	const note = await tryFindNoteById({
		payload,
		noteId: Number(params.noteId),
		req: payloadRequest,
	}).getOrElse(() => {
		throw new NotFoundResponse("Note not found");
	});

	// Extract createdBy ID (handle both depth 0 and 1)
	const createdById = note.createdBy.id;

	// Check if user can edit this note
	const editPermission = permissions.note.canEdit(currentUser, createdById);
	if (!editPermission.allowed) {
		throw new NotFoundResponse(editPermission.reason);
	}

	return {
		note,
		params,
	};
})!;

enum Action {
	UpdateNote = "updateNote",
}

const inputSchema = z.object({
	content: z.string().min(1),
	isPublic: z.boolean().optional(),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/note/edit/:noteId",
});

const createUpdateNoteActionRpc = createActionRpc({
	formDataSchema: inputSchema,
	method: "POST",
	action: Action.UpdateNote,
});

const updateNoteAction = createUpdateNoteActionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({ error: "Unauthorized" });
		}

		const noteId = params.noteId;

		// Update note with updated content
		const result = await tryUpdateNote({
			payload,
			noteId,
			data: {
				content: formData.content,
				isPublic: formData.isPublic,
			},
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({
				error: result.error.message,
			});
		}

		return redirect("/user/notes");
	},
);

const useUpdateNote = createUpdateNoteActionRpc.createHook<typeof updateNoteAction>();

const [action] = createActionMap({
	[Action.UpdateNote]: updateNoteAction,
});

export { action };

export const clientAction = async ({
	serverAction,
}: Route.ClientActionArgs) => {
	const actionData = await serverAction();
	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
};



export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function NoteEditPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { submit: updateNote, isLoading, fetcher } = useUpdateNote();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			content: loaderData.note.content,
			isPublic: Boolean(loaderData.note.isPublic),
		},
	});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		updateNote({
			values: {
				content: form.values.content,
				isPublic: form.values.isPublic,
			},
			params: { noteId: loaderData.note.id },
		});
	};

	return (
		<Container size="md" py="xl">
			<title>Edit Note | Paideia LMS</title>
			<meta name="description" content="Edit your note" />
			<meta property="og:title" content="Edit Note | Paideia LMS" />
			<meta property="og:description" content="Edit your note" />

			<Stack gap="xl">
				<Title order={1}>Edit Note</Title>

				<fetcher.Form method="post" onSubmit={handleSubmit}>
					<Paper withBorder shadow="md" p="xl" radius="md">
						<Stack gap="lg">
							<FormableRichTextEditor
								form={form}
								formKey={form.key("content")}
								key={form.key("content")}
								label="Content"
								placeholder="Write your note here..."
							/>

							<Checkbox
								{...form.getInputProps("isPublic", { type: "checkbox" })}
								key={form.key("isPublic")}
								label="Make this note public"
								description="Public notes can be viewed by other users"
							/>

							{(actionData?.error || fetcher.data?.error) && (
								<Text c="red" size="sm">
									{actionData?.error || fetcher.data?.error}
								</Text>
							)}

							<Group justify="flex-end" gap="md">
								<Button variant="subtle" onClick={() => navigate("/user/notes")} type="button">
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={!form.values.content.trim() || fetcher.state !== "idle"}
									loading={fetcher.state !== "idle"}
								>
									Update Note
								</Button>
							</Group>
						</Stack>
					</Paper>
				</fetcher.Form>
			</Stack>
		</Container>
	);
}
