import type { LoaderFunctionArgs } from "react-router";
import { href, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeCookie, removeImpersonationCookie } from "~/utils/cookie";
import { UnauthorizedResponse } from "~/utils/responses";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const requestInfo = context.get(globalContextKey).requestInfo;
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("Unauthorized");
	}

	// Remove both the login cookie and impersonation cookie
	const loginCookieRemoval = removeCookie(
		requestInfo.domainUrl,
		request.headers,
		payload,
	);

	const impersonationCookieRemoval = removeImpersonationCookie(
		requestInfo.domainUrl,
		request.headers,
		payload,
	);

	// Redirect to login with both cookies removed
	throw redirect(href("/login"), {
		headers: [
			["Set-Cookie", loginCookieRemoval],
			["Set-Cookie", impersonationCookieRemoval],
		],
	});
};
