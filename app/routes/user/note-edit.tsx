import { Container, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useState } from "react";
import { redirect, useFetcher, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryFindNoteById,
	tryUpdateNote,
} from "server/internal/note-management";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "~/components/rich-text-editor";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import { replaceBase64ImagesWithMediaUrls } from "~/utils/replace-base64-images";
import { badRequest, NotFoundResponse, StatusCode } from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/note-edit";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	const note = await tryFindNoteById({
		payload,
		noteId: Number(params.noteId),
		user: currentUser,
		overrideAccess: false,
	});

	if (!note.ok) {
		throw new NotFoundResponse("Note not found");
	}

	// Extract createdBy ID (handle both depth 0 and 1)
	const createdById = note.value.createdBy.id;

	// Check if user can edit this note
	if (currentUser.id !== createdById && currentUser.role !== "admin") {
		throw new NotFoundResponse("You don't have permission to edit this note");
	}

	return {
		note: note.value,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	const noteId = Number(params.noteId);
	if (Number.isNaN(noteId)) {
		throw new NotFoundResponse("Invalid note ID");
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload);

	// Parse form data with media upload handler
	const parseResult = await tryParseFormDataWithMediaUpload({
		payload,
		request,
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		maxFileSize,
		fields: [
			{
				fieldName: "image-*",
				alt: "Note image",
			},
		],
	});

	if (!parseResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return handleUploadError(
			parseResult.error,
			maxFileSize,
			"Failed to parse form data",
		);
	}

	const { formData, uploadedMedia } = parseResult.value;

	// Extract and validate form data
	let content = formData.get("content") as string;
	const isPublic = formData.get("isPublic") === "true";

	if (!content || content.trim().length === 0) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			error: "Note content cannot be empty",
		});
	}

	// Replace base64 images with actual media URLs
	content = replaceBase64ImagesWithMediaUrls(content, uploadedMedia, formData);

	// Update note with updated content
	// Pass transaction context so filename resolution can see uncommitted media
	const result = await tryUpdateNote({
		payload,
		noteId,
		data: {
			content,
			isPublic,
		},
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		overrideAccess: false,
	});

	if (!result.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			error: result.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return redirect("/user/notes");
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

const useUpdateNote = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const updateNote = (
		content: string,
		isPublic: boolean,
		imageFiles: ImageFile[],
	) => {
		// Create form data with content and isPublic
		const formData = new FormData();
		formData.append("content", content);
		formData.append("isPublic", isPublic ? "true" : "false");

		// Add each image file with a unique field name
		imageFiles.forEach((imageFile, index) => {
			formData.append(`image-${index}`, imageFile.file);
			formData.append(`image-${index}-preview`, imageFile.preview);
		});

		// Submit with fetcher
		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
		});
	};

	return {
		updateNote,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
		fetcher,
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
	const { updateNote, fetcher } = useUpdateNote();
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
