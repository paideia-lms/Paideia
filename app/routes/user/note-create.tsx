import { Container, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { useState } from "react";
import { href, redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateNote } from "server/internal/note-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { serverOnly$ } from "vite-env-only/macros";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "~/components/rich-text-editor";
import {
	badRequest,
	NotFoundResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/note-create";
import { z } from "zod";

export function getRouteUrl() {
	return href("/user/note/create");
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	return { user: currentUser };
};

enum Action {
	CreateNote = "createNote",
}

const inputSchema = z.object({
	content: z.string().min(1),
	isPublic: z.boolean().optional(),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createCreateNoteActionRpc = createActionRpc({
	formDataSchema: inputSchema,
	method: "POST",
	action: Action.CreateNote,
});

const [createNoteAction, useCreateNoteRpc] = createCreateNoteActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({
				error: "Unauthorized",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({
				error: "Unauthorized",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);
		return await transactionInfo.tx(async (txInfo) => {
			// Create note with updated content
			const result = await tryCreateNote({
				payload,
				data: {
					content: formData.content,
					isPublic: formData.isPublic,
					createdBy: currentUser.id,
				},
				req: txInfo.reqWithTransaction,
				overrideAccess: false,
			});

			if (!result.ok) {
				return badRequest({
					error: result.error.message,
				});
			}

			// redirect on the server side
			return redirect(href("/user/notes/:id?", { id: "" }));
		});
	})!,
	{
		action: () => href("/user/note/create"),
	},
);

const [action] = createActionMap({
	[Action.CreateNote]: createNoteAction,
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

const useCreateNote = () => {
	const { submit, isLoading, fetcher } = useCreateNoteRpc();

	const createNote = (
		content: string,
		isPublic: boolean,
		_imageFiles: ImageFile[],
	) => {
		// Note: imageFiles are not currently handled in the schema
		// They would need to be added to the formDataSchema if needed
		submit({
			values: {
				content,
				isPublic,
			},
		});
	};

	return {
		createNote,
		isSubmitting: isLoading,
		state: fetcher.state,
		data: fetcher.data,
		fetcher: fetcher as typeof fetcher & { data?: { error?: string } },
	};
};

export default function NoteCreatePage({ actionData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const { createNote, fetcher } = useCreateNote();
	const [content, setContent] = useState("");
	const [isPublic, setIsPublic] = useState(false);
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);

	const handleImageAdd = (imageFile: ImageFile) => {
		setImageFiles((prev) => [...prev, imageFile]);
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		createNote(content, isPublic, imageFiles);
	};

	return (
		<Container size="md" py="xl">
			<title>Create Note | Paideia LMS</title>
			<meta name="description" content="Create a new note" />
			<meta property="og:title" content="Create Note | Paideia LMS" />
			<meta property="og:description" content="Create a new note" />

			<Stack gap="xl">
				<Title order={1}>Create Note</Title>

				<NoteForm
					content={content}
					setContent={setContent}
					isPublic={isPublic}
					setIsPublic={setIsPublic}
					handleImageAdd={handleImageAdd}
					onSubmit={handleSubmit}
					onCancel={() => navigate("/user/notes")}
					fetcher={fetcher}
					submitLabel="Create Note"
					error={actionData?.error}
				/>
			</Stack>
		</Container>
	);
}
