import type { LoaderFunctionArgs } from "react-router";
import { href, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { removeCookie } from "~/utils/cookie";
import { UnauthorizedResponse } from "~/utils/responses";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const payload = context.get(globalContextKey).payload;
	const requestInfo = context.get(globalContextKey).requestInfo;
	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
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
