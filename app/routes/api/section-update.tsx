import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateSection } from "server/internal/course-section-management";
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
} from "~/utils/responses";
import type { Route } from "./+types/section-update";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

const inputSchema = z.object({
	sectionId: z.coerce.number(),
	title: z.string(),
	description: z.string().optional(),
});

export const action = async ({ context, request }: Route.ActionArgs) => {
	const userSession = context.get(userContextKey);
	const { payload, payloadRequest } = context.get(globalContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}


	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		return badRequest({ error: z.prettifyError(parsed.error) });
	}
	const { sectionId, title, description } = parsed.data;

	// Update the section
	const result = await tryUpdateSection({
		payload,
		sectionId,
		data: {
			title,
			description: description || undefined,
		},
		req: payloadRequest,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
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
			message: "Section updated successfully",
			color: "green",
		});
	}

	return actionData;
}

export function useUpdateCourseSection() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateSection = (data: {
		sectionId: number;
		title: string;
		description?: string;
	}) => {
		fetcher.submit(data, {
			method: "POST",
			action: href("/api/section-update"),
			encType: ContentType.JSON,
		});
	};

	return {
		updateSection,
		isLoading: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
}
