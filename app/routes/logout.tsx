import type { LoaderFunctionArgs } from "react-router";
import { dbContextKey } from "server/contexts/global-context";
import { removeCookie } from "~/utils/cookie";
import { ok, UnauthorizedResponse } from "~/utils/responses";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const payload = context.get(dbContextKey).payload;
	const requestInfo = context.get(dbContextKey).requestInfo;
	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		throw new UnauthorizedResponse("Unauthorized");
	}

	// remove the cookie

	return ok(
		{
			success: true,
			message: "Logout successful",
		},
		{
			headers: {
				"Set-Cookie": removeCookie(requestInfo.domainUrl),
			},
		},
	);
};
