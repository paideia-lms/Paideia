import { notifications } from "@mantine/notifications";
import { href, redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryDeleteActivityModule } from "server/internal/activity-module-management";
import { z } from "zod";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
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
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "User not found" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		// ! this function will not throw because it will return a result object
		const result = await tryDeleteActivityModule({
			payload,
			id: formData.moduleId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		// Redirect to user modules page after successful deletion
		return redirect(
			href("/user/modules/:id?", { id: String(currentUser.id) }),
		);
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
