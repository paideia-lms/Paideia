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
import type {
    FileUpload,
    FileUploadHandler,
} from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import * as cheerio from "cheerio";
import { useState } from "react";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryCreateMedia } from "server/internal/media-management";
import { tryCreateNote } from "server/internal/note-management";
import { type ImageFile, RichTextEditor } from "~/components/rich-text-editor";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { badRequest, NotFoundResponse } from "~/utils/responses";
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
                        const mediaUrl = href("/api/media/file/:filename", {
                            filename,
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
            user: currentUser,
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
            error:
                error instanceof Error ? error.message : "Failed to create note",
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
                <Group justify="space-between" align="center">
                    <Title order={1}>Create Note</Title>
                    <Button variant="subtle" onClick={() => navigate("/user/notes")}>
                        Cancel
                    </Button>
                </Group>

                <fetcher.Form method="post" onSubmit={handleSubmit}>
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
                                    onImageAdd={handleImageAdd}
                                />
                            </div>

                            <Checkbox
                                label="Make this note public"
                                description="Public notes can be viewed by other users"
                                checked={isPublic}
                                onChange={(event) => setIsPublic(event.currentTarget.checked)}
                            />

                            {(actionData?.error || fetcher.data?.error) && (
                                <Text c="red" size="sm">
                                    {actionData?.error || fetcher.data?.error}
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
                                <Button
                                    type="submit"
                                    disabled={!content.trim() || fetcher.state !== "idle"}
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
