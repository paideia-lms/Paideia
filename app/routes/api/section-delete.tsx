import { notifications } from "@mantine/notifications";
import { href, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryDeleteSection } from "server/internal/course-section-management";
import z from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/section-delete";

const inputSchema = z.object({
	sectionId: z.number(),
	courseId: z.number(),
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

	const { sectionId, courseId } = parsed.data;

	console.log(`Deleting section ${sectionId}`);

	try {
		// Call tryDeleteSection with the parsed parameters
		const result = await tryDeleteSection({
			payload,
			sectionId,
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			overrideAccess: false,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		// Redirect to course root after successful deletion
		throw redirect(
			href("/course/:courseId", { courseId: courseId.toString() }),
		);
	} catch (error) {
		if (error instanceof Response) throw error;
		console.error("Failed to delete section:", error);
		return badRequest({ error: "Failed to delete section" });
	}
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

type DeleteSectionOperation = z.infer<typeof inputSchema>;

// Custom hook for deleting a course section
export function useDeleteCourseSection() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteSection = async (op: DeleteSectionOperation) => {
		fetcher.submit(op, {
			method: "POST",
			action: href("/api/section-delete"),
			encType: "application/json",
		});
	};

	return {
		deleteSection,
		isLoading: fetcher.state !== "idle",
		error:
			fetcher.data?.status === StatusCode.BadRequest
				? fetcher.data.error
				: undefined,
	};
}
