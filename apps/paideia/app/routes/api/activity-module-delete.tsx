import { notifications } from "@mantine/notifications";
import { href, redirect } from "react-router";
import { typeCreateActionRpc } from "app/utils/router/action-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { z } from "zod";
import {
	badRequest,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/activity-module-delete";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/api/activity-module-delete",
});

const deleteActivityModuleRpc = createActionRpc({
	formDataSchema: z.object({
		moduleId: z.coerce.number(),
	}),
	method: "POST",
});

const deleteActivityModuleAction = deleteActivityModuleRpc.createAction(
	async ({ context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "User not found" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		const result = await paideia.tryDeleteActivityModule({
			id: formData.moduleId,
			req: requestContext,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		// Redirect to user modules page after successful deletion
		return redirect(href("/user/modules/:id?", { id: String(currentUser.id) }));
	},
);

const useDeleteActivityModule =
	deleteActivityModuleRpc.createHook<typeof deleteActivityModuleAction>();

// Export hook for use in components
export { useDeleteActivityModule };

export const action = deleteActivityModuleAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
}
