import { Container, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateNote } from "server/internal/note-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "~/components/rich-text-editor";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import { replaceBase64ImagesWithMediaUrls } from "~/utils/replace-base64-images";
import {
	badRequest,
	NotFoundResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/note-create";

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

export const action = async ({ request, context }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload, systemGlobals, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(
		payload,
		payloadRequest,
	);
	return await transactionInfo.tx(async (txInfo) => {
		// Parse form data with media upload handler
		const parseResult = await tryParseFormDataWithMediaUpload({
			payload,
			request,
			userId: currentUser.id,
			req: txInfo.reqWithTransaction,
			maxFileSize,
			fields: [
				{
					fieldName: "image-*",
					alt: "Note image",
				},
			],
		});

		if (!parseResult.ok) {
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
			return badRequest({
				error: "Note content cannot be empty",
			});
		}

		// Replace base64 images with actual media URLs
		content = replaceBase64ImagesWithMediaUrls(
			content,
			uploadedMedia,
			formData,
		);

		// Create note with updated content
		// Pass transaction context so filename resolution can see uncommitted media
		const result = await tryCreateNote({
			payload,
			data: {
				content,
				createdBy: currentUser.id,
				isPublic,
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

const useCreateNote = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const createNote = (
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
		createNote,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
		fetcher,
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
