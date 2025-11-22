import { notifications } from "@mantine/notifications";
import { href, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryDeleteActivityModule } from "server/internal/activity-module-management";
import z from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/activity-module-delete";

const inputSchema = z.object({
	moduleId: z.number(),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "User not found" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsed = inputSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({ error: z.prettifyError(parsed.error) });
	}

	const { moduleId } = parsed.data;

	// ! this function will not throw because it will return a result object
	const result = await tryDeleteActivityModule({
		payload,
		id: moduleId,
		user: currentUser,
		req: request,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	// Redirect to user modules page after successful deletion
	throw redirect(href("/user/modules/:id?", { id: String(currentUser.id) }));
};

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

type DeleteActivityModuleOperation = z.infer<typeof inputSchema>;

// Custom hook for deleting an activity module
export function useDeleteActivityModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteModule = async (op: DeleteActivityModuleOperation) => {
		fetcher.submit(op, {
			method: "POST",
			action: href("/api/activity-module-delete"),
			encType: "application/json",
		});
	};

	return {
		deleteModule,
		isLoading: fetcher.state !== "idle",
		error:
			fetcher.data?.status === StatusCode.BadRequest
				? fetcher.data.error
				: undefined,
	};
}
