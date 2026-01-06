import { Button, Checkbox, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { href, redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateNote } from "server/internal/note-management";
import { FormableRichTextEditor } from "app/components/form-components/formable-rich-text-editor";
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
		// Create note with updated content
		const result = await tryCreateNote({
			payload,
			data: {
				content: formData.content,
				isPublic: formData.isPublic,
				createdBy: currentUser.id,
			},
			req: payloadRequest,

		});

		if (!result.ok) {
			return badRequest({
				error: result.error.message,
			});
		}

		// redirect on the server side
		return redirect(href("/user/notes/:id?", { id: "" }));
	});

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

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			content: "",
			isPublic: false,
		},
	});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		createNote({
			values: {
				content: form.values.content,
				isPublic: form.values.isPublic,
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

				<fetcher.Form method="post" onSubmit={handleSubmit}>
					<Paper withBorder shadow="md" p="xl" radius="md">
						<Stack gap="lg">
							<FormableRichTextEditor
								form={form}
								formKey={"content"}
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
									Create Note
								</Button>
							</Group>
						</Stack>
					</Paper>
				</fetcher.Form>
			</Stack>
		</Container>
	);
}
