import type { LoaderFunctionArgs } from "react-router";
import { href, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import { removeAuthCookie, removeImpersonationCookie } from "@paideia/core";
import { UnauthorizedResponse } from "app/utils/router/responses";

const createRouteLoader = typeCreateLoader<LoaderFunctionArgs>();

export const loader = createRouteLoader()(async ({ context, request }) => {
	const { paideia, requestInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("Unauthorized");
	}

	const cookieOpts = {
		cookiePrefix: paideia.getCookiePrefix(),
		domainUrl: requestInfo.domainUrl,
		headers: request.headers,
	};
	// Remove both the login cookie and impersonation cookie
	const loginCookieRemoval = removeAuthCookie(cookieOpts);
	const impersonationCookieRemoval = removeImpersonationCookie(cookieOpts);

	// Redirect to login with both cookies removed
	return redirect(href("/login"), {
		headers: [
			["Set-Cookie", loginCookieRemoval],
			["Set-Cookie", impersonationCookieRemoval],
		],
	});
});
