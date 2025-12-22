import { Container, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { useState } from "react";
import { href, redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryFindNoteById,
	tryUpdateNote,
} from "server/internal/note-management";
import { serverOnly$ } from "vite-env-only/macros";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "~/components/rich-text-editor";
import { badRequest, NotFoundResponse, StatusCode } from "~/utils/responses";
import type { Route } from "./+types/note-edit";
import { z } from "zod";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
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
	if (currentUser.id !== createdById && currentUser.role !== "admin") {
		throw new NotFoundResponse("You don't have permission to edit this note");
	}

	return {
		note,
	};
};

enum Action {
	UpdateNote = "updateNote",
}

const inputSchema = z.object({
	content: z.string().min(1),
	isPublic: z.boolean().optional(),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createUpdateNoteActionRpc = createActionRpc({
	formDataSchema: inputSchema,
	method: "POST",
	action: Action.UpdateNote,
});

const [updateNoteAction, useUpdateNoteRpc] = createUpdateNoteActionRpc(
	serverOnly$(async ({ context, formData, params }) => {
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

		const noteId = Number(params.noteId);
		if (Number.isNaN(noteId)) {
			return badRequest({ error: "Invalid note ID" });
		}

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
	})!,
	{
		action: ({ params }) =>
			href("/user/note/edit/:noteId", { noteId: String(params.noteId) }),
	},
);

const actionMap = {
	[Action.UpdateNote]: updateNoteAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const url = new URL(request.url);
	const actionFromUrl = url.searchParams.get("action") as Action | null;

	if (!actionFromUrl || !(actionFromUrl in actionMap)) {
		return badRequest({ error: "Invalid action" });
	}

	return actionMap[actionFromUrl](args);
};

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

const useUpdateNote = (noteId: number) => {
	const { submit, isLoading, fetcher } = useUpdateNoteRpc();

	const updateNote = (
		content: string,
		isPublic: boolean,
		_imageFiles: ImageFile[],
	) => {
		// Note: imageFiles are not currently handled in the schema
		// They would need to be added to the formDataSchema if needed
		submit({
			params: { noteId },
			values: {
				content,
				isPublic,
			},
		});
	};

	return {
		updateNote,
		isSubmitting: isLoading,
		state: fetcher.state,
		data: fetcher.data,
		fetcher: fetcher as typeof fetcher & { data?: { error?: string } },
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function NoteEditPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { updateNote, fetcher } = useUpdateNote(loaderData.note.id);
	const [content, setContent] = useState(loaderData.note.content);
	const [isPublic, setIsPublic] = useState(Boolean(loaderData.note.isPublic));
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);

	const handleImageAdd = (imageFile: ImageFile) => {
		setImageFiles((prev) => [...prev, imageFile]);
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		updateNote(content, isPublic, imageFiles);
	};

	return (
		<Container size="md" py="xl">
			<title>Edit Note | Paideia LMS</title>
			<meta name="description" content="Edit your note" />
			<meta property="og:title" content="Edit Note | Paideia LMS" />
			<meta property="og:description" content="Edit your note" />

			<Stack gap="xl">
				<Title order={1}>Edit Note</Title>

				<NoteForm
					content={content}
					setContent={setContent}
					isPublic={Boolean(isPublic)}
					setIsPublic={setIsPublic}
					handleImageAdd={handleImageAdd}
					onSubmit={handleSubmit}
					onCancel={() => navigate("/user/notes")}
					fetcher={fetcher}
					submitLabel="Update Note"
					error={actionData?.error}
				/>
			</Stack>
		</Container>
	);
}
