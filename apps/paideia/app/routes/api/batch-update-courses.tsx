import { notifications } from "@mantine/notifications";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import z from "zod";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/batch-update-courses";
import { typeCreateActionRpc } from "app/utils/router/action-utils";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/api/batch-update-courses",
});

const inputSchema = z
	.object({
		courseIds: z.array(z.coerce.number()).min(1, "Select at least one course"),
		status: z.enum(["draft", "published", "archived"]).optional(),
		category: z.coerce.number().nullable().optional(),
	})
	.refine((data) => data.status !== undefined || data.category !== undefined, {
		message: "Provide at least one of status or category",
	});

const batchUpdateCoursesRpc = createActionRpc({
	formDataSchema: inputSchema,
	method: "POST",
});

const batchUpdateCoursesAction = batchUpdateCoursesRpc.createAction(
	async ({ request, context, formData }) => {
		const { paideia, requestContext } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "User not found" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (currentUser.role !== "admin") {
			throw new ForbiddenResponse("Only admins can batch update courses");
		}

		// const { data } = await getDataAndContentTypeFromRequest(request);
		// const parsed = inputSchema.safeParse(data);
		// if (!parsed.success) {
		// 	return badRequest({ error: z.prettifyError(parsed.error) });
		// }

		const { courseIds, status, category } = formData;

		// Perform per-course updates; keep simple and robust
		for (const courseId of courseIds) {
			const updateResult = await paideia.tryUpdateCourse({
				courseId,
				data: {
					...(status ? { status } : {}),
					...(category !== undefined ? { category: category ?? null } : {}),
				},
				req: requestContext,
			});

			if (!updateResult.ok) {
				return badRequest({ error: updateResult.error.message });
			}
		}

		return ok({ success: true });
	},
);

const useBatchUpdateCourses =
	batchUpdateCoursesRpc.createHook<typeof batchUpdateCoursesAction>();

export const action = batchUpdateCoursesAction;
export { useBatchUpdateCourses };

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
			message: "Courses updated",
			color: "green",
		});
	}

	return actionData;
}
