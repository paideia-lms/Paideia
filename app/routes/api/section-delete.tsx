import { notifications } from "@mantine/notifications";
import { href, redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryDeleteSection } from "server/internal/course-section-management";
import { z } from "zod";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/section-delete";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createDeleteSectionActionRpc = createActionRpc({
	formDataSchema: z.object({
		sectionId: z.coerce.number(),
		courseId: z.coerce.number(),
	}),
	method: "POST",
});

export function getRouteUrl() {
	return href("/api/section-delete");
}

const [deleteSectionAction, useDeleteCourseSection] =
	createDeleteSectionActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);
			const userSession = context.get(userContextKey);

			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "User not found" });
			}

			// Call tryDeleteSection with the parsed parameters
			const result = await tryDeleteSection({
				payload,
				sectionId: formData.sectionId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({ error: result.error.message });
			}

			// Redirect to course root after successful deletion
			return redirect(
				href("/course/:courseId", {
					courseId: formData.courseId.toString(),
				}),
			);
		})!,
		{
			action: getRouteUrl,
		},
	);

// Export hook for use in components
export { useDeleteCourseSection };

export const action = deleteSectionAction;

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
