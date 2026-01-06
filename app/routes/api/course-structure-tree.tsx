// This file previously managed course structure using a JSON field
// Now it needs to be updated to work with the course-sections collection

import { notifications } from "@mantine/notifications";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGeneralMove } from "server/internal/course-section-management";
import { z } from "zod";
import { badRequest, ok, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/course-structure-tree";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/api/course-structure-tree",
});

const updateCourseStructureRpc = createActionRpc({
	formDataSchema: z.object({
		courseId: z.coerce.number(),
		sourceId: z.coerce.number(),
		sourceType: z.enum(["section", "activity-module"]),
		targetId: z.coerce.number(),
		targetType: z.enum(["section", "activity-module"]),
		location: z.enum(["above", "below", "inside"]),
	}),
	method: "POST",
});

const updateCourseStructureAction = updateCourseStructureRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "User not found" });
		}

		const { sourceId, sourceType, targetId, targetType, location } = formData;

		console.log(
			`Moving ${sourceType} ${sourceId} to ${location} ${targetType} ${targetId}`,
		);

		// Call tryGeneralMove with the parsed parameters
		const result = await tryGeneralMove({
			payload,
			source: { id: sourceId, type: sourceType },
			target: { id: targetId, type: targetType },
			location,
			req: payloadRequest,
		});

		// ! we return error response in action because this route has a default page component
		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({
			success: true,
			message: "Course structure updated successfully",
		});
	},
);

const useUpdateCourseStructure =
	updateCourseStructureRpc.createHook<typeof updateCourseStructureAction>();

// Export hook for use in components
export { useUpdateCourseStructure };

export const action = updateCourseStructureAction;
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
