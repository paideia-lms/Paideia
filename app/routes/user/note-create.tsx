import { Container, Stack, Title } from "@mantine/core";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import * as cheerio from "cheerio";
import { useState } from "react";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateMedia } from "server/internal/media-management";
import { tryCreateNote } from "server/internal/note-management";
import { NoteForm } from "~/components/note-form";
import type { ImageFile } from "~/components/rich-text-editor";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { badRequest, NotFoundResponse, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/note-create";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	return { user: currentUser };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "Unauthorized",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Start transaction for atomic media creation + note creation
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			error: "Failed to begin transaction",
		});
	}

	try {
		// Store uploaded media info - map fieldName to uploaded filename
		const uploadedMedia: { fieldName: string; filename: string }[] = [];

		// Parse form data with upload handler
		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName.startsWith("image-")) {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				// Create media record within transaction
				const mediaResult = await tryCreateMedia(payload, {
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: "Note image",
					userId: currentUser.id,
					transactionID,
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				// Store the field name and filename for later matching
				uploadedMedia.push({
					fieldName: fileUpload.fieldName,
					filename: mediaResult.value.media.filename ?? fileUpload.name,
				});

				return mediaResult.value.media.id;
			}
		};

		const formData = await parseFormData(
			request,
			uploadHandler as FileUploadHandler,
		);

		let content = formData.get("content") as string;
		const isPublic = formData.get("isPublic") === "true";

		if (!content || content.trim().length === 0) {
			await payload.db.rollbackTransaction(transactionID);
			return {
				error: "Note content cannot be empty",
			};
		}

		// Replace base64 images with actual media URLs
		if (uploadedMedia.length > 0) {
			// Build a map of base64 prefix to filename
			const base64ToFilename = new Map<string, string>();

			uploadedMedia.forEach((media) => {
				const previewKey = `${media.fieldName}-preview`;
				const preview = formData.get(previewKey) as string;
				if (preview) {
					const base64Prefix = preview.substring(0, 100);
					base64ToFilename.set(base64Prefix, media.filename);
				}
			});
			const $ = cheerio.load(content);
			const images = $("img");

			images.each((_i, img) => {
				const src = $(img).attr("src");
				if (src?.startsWith("data:image")) {
					// Find matching uploaded media by comparing base64 prefix
					const base64Prefix = src.substring(0, 100);
					const filename = base64ToFilename.get(base64Prefix);

					if (filename) {
						// Replace with actual media URL
						const mediaUrl = href("/api/media/file/:filenameOrId", {
							filenameOrId: filename,
						});
						$(img).attr("src", mediaUrl);
					}
				}
			});

			content = $.html();
		}

		// Create note with updated content
		const result = await tryCreateNote({
			payload,
			data: {
				content,
				createdBy: currentUser.id,
				isPublic,
			},
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!result.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return {
				error: result.error.message,
			};
		}

		// Commit the transaction
		await payload.db.commitTransaction(transactionID);

		return redirect("/user/notes");
	} catch (error) {
		// Rollback on any error
		await payload.db.rollbackTransaction(transactionID);
		console.error("Note creation error:", error);
		return badRequest({
			error: error instanceof Error ? error.message : "Failed to create note",
		});
	}
};

export default function NoteCreatePage({ actionData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const fetcher = useFetcher<typeof action>();
	const [content, setContent] = useState("");
	const [isPublic, setIsPublic] = useState(false);
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);

	const handleImageAdd = (imageFile: ImageFile) => {
		setImageFiles((prev) => [...prev, imageFile]);
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

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
			encType: "multipart/form-data",
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
