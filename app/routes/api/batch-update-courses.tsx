import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateCourse } from "server/internal/course-management";
import z from "zod";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/batch-update-courses";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

const inputSchema = z
	.object({
		courseIds: z.array(z.coerce.number()).min(1, "Select at least one course"),
		status: z.enum(["draft", "published", "archived"]).optional(),
		category: z.coerce.number().nullable().optional(),
	})
	.refine((data) => data.status !== undefined || data.category !== undefined, {
		message: "Provide at least one of status or category",
	});

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "User not found" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can batch update courses");
	}

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		return badRequest({ error: z.prettifyError(parsed.error) });
	}

	const { courseIds, status, category } = parsed.data;

	// Perform per-course updates; keep simple and robust
	for (const courseId of courseIds) {
		const updateResult = await tryUpdateCourse({
			payload,
			courseId,
			data: {
				...(status ? { status } : {}),
				...(category !== undefined ? { category: category ?? null } : {}),
			},
			req: createLocalReq({
				request,
				user: currentUser,
				context: { routerContext: context },
			}),
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}
	}

	return ok({ success: true });
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

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: "Courses updated",
			color: "green",
		});
	}

	return actionData;
}

export function useBatchUpdateCourses() {
	const fetcher = useFetcher<typeof clientAction>();

	const batchUpdateCourses = (data: {
		courseIds: number[];
		status?: "draft" | "published" | "archived";
		category?: number | null;
	}) => {
		fetcher.submit(data, {
			method: "POST",
			action: href("/api/batch-update-courses"),
			encType: ContentType.JSON,
		});
	};

	return {
		batchUpdateCourses,
		isLoading: fetcher.state !== "idle",
		error:
			fetcher.data?.status === StatusCode.BadRequest
				? fetcher.data.error
				: undefined,
		success: fetcher.data?.status === StatusCode.Ok,
	};
}
