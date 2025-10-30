import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCategory } from "server/internal/course-category-management";
import z from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, ok, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/category-reorder";

const inputSchema = z.object({
    sourceId: z.number(),
    newParentId: z.number(),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "User not found" });
    }

    const { data } = await getDataAndContentTypeFromRequest(request);
    const parsed = inputSchema.safeParse(data);

    if (!parsed.success) {
        return badRequest({ error: z.treeifyError(parsed.error) });
    }

    const { sourceId, newParentId } = parsed.data;

    // Only admin can manage categories
    const currentUser = userSession.effectiveUser || userSession.authenticatedUser;
    if (currentUser.role !== "admin") {
        return badRequest({ error: "Only admins can manage categories" });
    }

    // Reparent only, moving to root is not supported by UI contract
    if (!Number.isFinite(newParentId)) {
        return badRequest({ error: "Invalid target parent" });
    }

    const result = await tryUpdateCategory(payload, request, sourceId, { parent: newParentId });
    if (!result.ok) {
        return badRequest({ error: result.error.message });
    }

    return ok({ success: true, message: "Category parent updated" });
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
        notifications.show({ title: "Success", message: actionData.message, color: "green" });
    }

    return actionData;
}

type ReorderOperation = z.infer<typeof inputSchema>;

export function useReorderCategories() {
    const fetcher = useFetcher<typeof clientAction>();

    const reorderCategories = async (op: ReorderOperation) => {
        fetcher.submit(op, {
            method: "POST",
            action: href("/api/category-reorder"),
            encType: "application/json",
        });
    };

    return {
        reorderCategories,
        isLoading: fetcher.state !== "idle",
        error: fetcher.data?.status === StatusCode.BadRequest ? fetcher.data.error : undefined,
        success: fetcher.data?.status === StatusCode.Ok,
    };
}


