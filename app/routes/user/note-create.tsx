import { Container, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useState } from "react";
import { href, redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateNote } from "server/internal/note-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "app/components/rich-text/rich-text-editor";
import {
	badRequest,
	NotFoundResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/note-create";
import { z } from "zod";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	return { user: currentUser, params };
})!;

enum Action {
	CreateNote = "createNote",
}

const inputSchema = z.object({
	content: z.string().min(1),
	isPublic: z.boolean().optional(),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/note/create",
});

const createCreateNoteActionRpc = createActionRpc({
	formDataSchema: inputSchema,
	method: "POST",
	action: Action.CreateNote,
});

const createNoteAction = createCreateNoteActionRpc.createAction(
	async ({ context, formData }) => {
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
	},
);

const useCreateNote = createCreateNoteActionRpc.createHook<typeof createNoteAction>();

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

export default function NoteCreatePage({ actionData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const { submit: createNote, isLoading, fetcher } = useCreateNote();
	const [content, setContent] = useState("");
	const [isPublic, setIsPublic] = useState(false);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		createNote({
			values: {
				content,
				isPublic,
			},
		});
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
