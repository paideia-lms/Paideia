import {
	Button,
	Checkbox,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useState } from "react";
import { Form, redirect, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryCreateNote } from "server/internal/note-management";
import { RichTextEditor } from "~/components/rich-text-editor";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/note-create";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	return { user: currentUser };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	const formData = await request.formData();
	const content = formData.get("content") as string;
	const isPublic = formData.get("isPublic") === "true";

	if (!content || content.trim().length === 0) {
		return {
			error: "Note content cannot be empty",
		};
	}

	const result = await tryCreateNote({
		payload,
		data: {
			content,
			createdBy: currentUser.id,
			isPublic,
		},
		user: currentUser,
		overrideAccess: false,
	});

	if (!result.ok) {
		return {
			error: result.error.message,
		};
	}

	return redirect("/user/notes");
};

export default function NoteCreatePage({ actionData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const [content, setContent] = useState("");
	const [isPublic, setIsPublic] = useState(false);

	return (
		<Container size="md" py="xl">
			<title>Create Note | Paideia LMS</title>
			<meta name="description" content="Create a new note" />
			<meta property="og:title" content="Create Note | Paideia LMS" />
			<meta property="og:description" content="Create a new note" />

			<Stack gap="xl">
				<Group justify="space-between" align="center">
					<Title order={1}>Create Note</Title>
					<Button variant="subtle" onClick={() => navigate("/user/notes")}>
						Cancel
					</Button>
				</Group>

				<Form method="post">
					<Paper withBorder shadow="md" p="xl" radius="md">
						<Stack gap="lg">
							<div>
								<Text size="sm" fw={500} mb="xs">
									Content
								</Text>
								<RichTextEditor
									placeholder="Write your note here..."
									content={content}
									onChange={setContent}
								/>
								<input type="hidden" name="content" value={content} />
							</div>

							<Checkbox
								label="Make this note public"
								description="Public notes can be viewed by other users"
								checked={isPublic}
								onChange={(event) => setIsPublic(event.currentTarget.checked)}
								name="isPublic"
								value={isPublic ? "true" : "false"}
							/>

							{actionData?.error && (
								<Text c="red" size="sm">
									{actionData.error}
								</Text>
							)}

							<Group justify="flex-end" gap="md">
								<Button
									variant="subtle"
									onClick={() => navigate("/user/notes")}
									type="button"
								>
									Cancel
								</Button>
								<Button type="submit" disabled={!content.trim()}>
									Create Note
								</Button>
							</Group>
						</Stack>
					</Paper>
				</Form>
			</Stack>
		</Container>
	);
}
