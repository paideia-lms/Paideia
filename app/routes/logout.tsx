import type { LoaderFunctionArgs } from "react-router";
import { href, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeCookie } from "~/utils/cookie";
import { UnauthorizedResponse } from "~/utils/responses";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const requestInfo = context.get(globalContextKey).requestInfo;
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("Unauthorized");
	}

	// remove the cookie
	throw redirect(href("/login"), {
		headers: {
			"Set-Cookie": removeCookie(
				requestInfo.domainUrl,
				request.headers,
				payload,
			),
		},
	});
};
