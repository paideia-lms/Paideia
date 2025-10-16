// TODO: Update this file to use the new course-sections system
// This file previously managed course structure using a JSON field
// Now it needs to be updated to work with the course-sections collection

import { badRequest, ok, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/course-structure-tree";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import z from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { tryGeneralMove } from "server/internal/course-section-management";
import { href, useFetcher } from "react-router";
import { notifications } from "@mantine/notifications";

const inputSchema = z.object({
    courseId: z.number(),
    sourceId: z.number(),
    sourceType: z.enum(["section", "activity-module"]),
    targetId: z.number(),
    targetType: z.enum(["section", "activity-module"]),
    location: z.enum(["above", "below", "inside"]),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "User not found" });
    }

    const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

    const { data, contentType } = await getDataAndContentTypeFromRequest(request);

    const parsed = inputSchema.safeParse(data);

    if (!parsed.success) {
        return badRequest({ error: z.treeifyError(parsed.error) });
    }

    const { courseId, sourceId, sourceType, targetId, targetType, location } = parsed.data;

    try {
        // Call tryGeneralMove with the parsed parameters
        const result = await tryGeneralMove({
            payload,
            source: { id: sourceId, type: sourceType },
            target: { id: targetId, type: targetType },
            location,
            user: {
                ...currentUser,
                avatar: currentUser.avatar?.id,
            },
            overrideAccess: false,
        });

        if (!result.ok) {
            return badRequest({ error: result.error.message });
        }

        return ok({ success: true, message: "Course structure updated successfully" });
    } catch (error) {
        console.error("Failed to update course structure:", error);
        return badRequest({ error: "Failed to update course structure" });
    }
};
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const actionData = await serverAction();

    if (actionData?.status === StatusCode.BadRequest) {
        notifications.show({
            title: "Error",
            message: typeof actionData.error === "string" ? actionData.error : actionData.error.errors.join(", "),
            color: "red",
        });
    }

    if (actionData?.status === StatusCode.Ok) {
        notifications.show({
            title: "Success",
            message: actionData.message,
            color: "green",
        });
    }

    return actionData;
}

type MoveOperation = z.infer<typeof inputSchema>;

// Custom hook for updating course structure
export function useUpdateCourseStructure() {
    const fetcher = useFetcher<typeof clientAction>();

    const updateCourseStructure = async (op: MoveOperation) => {
        fetcher.submit(op, {
            method: "POST",
            action: href("/api/course-structure-tree"),
            encType: "application/json",
        });
    };

    return {
        updateCourseStructure,
        isLoading: fetcher.state !== "idle",
        error: fetcher.data?.status === StatusCode.BadRequest ? fetcher.data.error : undefined,
        success: fetcher.data?.status === StatusCode.Ok,
    };
}
