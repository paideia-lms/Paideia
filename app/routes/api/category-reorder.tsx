import { notifications } from "@mantine/notifications";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCategory } from "server/internal/course-category-management";
import { z } from "zod";
import { badRequest, ok, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/category-reorder";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/api/category-reorder",
});

const reorderCategoriesRpc = createActionRpc({
	formDataSchema: z.object({
		sourceId: z.coerce.number(),
		newParentId: z.preprocess((val) => {
			if (val === null || val === undefined || val === "") {
				return null;
			}
			const num = Number(val);
			return Number.isFinite(num) ? num : null;
		}, z.number().nullable()),
	}),
	method: "POST",
});

const reorderCategoriesAction = reorderCategoriesRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "User not found" });
		}

		const { sourceId, newParentId } = formData;

		// Only admin can manage categories
		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;
		if (currentUser.role !== "admin") {
			return badRequest({ error: "Only admins can manage categories" });
		}

		// Allow moving to top-level via null parent
		if (newParentId !== null && !Number.isFinite(newParentId)) {
			return badRequest({ error: "Invalid target parent" });
		}

		const result = await tryUpdateCategory({
			payload,
			categoryId: sourceId,
			parent: newParentId,
			req: payloadRequest,
		});
		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({ success: true, message: "Category parent updated" });
	},
);

const useReorderCategories =
	reorderCategoriesRpc.createHook<typeof reorderCategoriesAction>();

// Export hook for use in components
export { useReorderCategories };

export const action = reorderCategoriesAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
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
