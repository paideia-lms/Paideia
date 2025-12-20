import { notifications } from "@mantine/notifications";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateSection } from "server/internal/course-section-management";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/section-update";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createUpdateSectionActionRpc = createActionRpc({
	formDataSchema: z.object({
		sectionId: z.coerce.number(),
		title: z.string().min(1),
		description: z.string().optional(),
	}),
	method: "POST",
});

const getRouteUrl = () => {
	return href("/api/section-update");
};

const [updateSectionAction, useUpdateCourseSection] =
	createUpdateSectionActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const userSession = context.get(userContextKey);
			const { payload, payloadRequest } = context.get(globalContextKey);

			if (!userSession?.isAuthenticated) {
				throw new ForbiddenResponse("Unauthorized");
			}

			// Update the section
			const result = await tryUpdateSection({
				payload,
				sectionId: formData.sectionId,
				data: {
					title: formData.title,
					description: formData.description || undefined,
				},
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({ error: result.error.message });
			}

			return ok({ success: true });
		})!,
		{
			action: getRouteUrl,
		},
	);

// Export hook for use in components
export { useUpdateCourseSection };

export const action = updateSectionAction;

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
			message: "Section updated successfully",
			color: "green",
		});
	}

	return actionData;
}
