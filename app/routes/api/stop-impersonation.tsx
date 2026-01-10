import { notifications } from "@mantine/notifications";
import { href, redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { z } from "zod";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeImpersonationCookie } from "~/utils/cookie";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/stop-impersonation";
import { getRouteUrl } from "app/utils/search-params-utils";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/api/stop-impersonation",
});

const stopImpersonationRpc = createActionRpc({
	formDataSchema: z.object({}),
	method: "POST",
});

const stopImpersonationAction = stopImpersonationRpc.createAction(
	async ({ context, request }) => {
		const { payload, requestInfo, pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!userSession.isImpersonating) {
			return badRequest({ error: "Not currently impersonating" });
		}

		// Determine redirect URL based on current location
		// If in a course, redirect back to that course after stopping impersonation
		const redirectTo = pageInfo.is["layouts/course-layout"]
			? pageInfo.is["layouts/course-layout"].params.courseId
				? getRouteUrl("/course/:courseId", {
						params: {
							courseId:
								pageInfo.is["layouts/course-layout"].params.courseId.toString(),
						},
						searchParams: { reload: true },
					})
				: pageInfo.is["layouts/course-layout"].params.moduleLinkId
					? getRouteUrl("/course/module/:moduleLinkId", {
							params: {
								moduleLinkId:
									pageInfo.is[
										"layouts/course-layout"
									].params.moduleLinkId.toString(),
							},
							searchParams: { view: null, threadId: null, replyTo: null },
						})
					: pageInfo.is["layouts/course-layout"].params.sectionId
						? getRouteUrl("/course/section/:sectionId", {
								params: {
									sectionId:
										pageInfo.is[
											"layouts/course-layout"
										].params.sectionId.toString(),
								},
								searchParams: { reload: true },
							})
						: href("/")
			: href("/");

		// Remove impersonation cookie and redirect
		return redirect(redirectTo, {
			headers: {
				"Set-Cookie": removeImpersonationCookie(
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	},
);

const useStopImpersonating =
	stopImpersonationRpc.createHook<typeof stopImpersonationAction>();

// Export hook for use in components
export { useStopImpersonating };

export const action = stopImpersonationAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
}
