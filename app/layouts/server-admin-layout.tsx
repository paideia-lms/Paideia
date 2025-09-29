import {
	Outlet,
	RouterContext,
	RouterContextProvider,
	useLocation,
} from "react-router";
import { dbContextKey } from "server/contexts/global-context";
import { Result } from "typescript-result";
import { ContextNotFoundError } from "~/utils/error";
import { BadRequestResponse, UnauthorizedResponse } from "~/utils/responses";
import { tryGetContext } from "~/utils/try-get-context";
import type { Route } from "./+types/server-admin-layout";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const contextResult = tryGetContext(context, dbContextKey);

	if (!contextResult.ok) {
		throw new BadRequestResponse("Context not found");
	}

	const { payload } = contextResult.value;

	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user || user.role !== "admin") {
		throw new UnauthorizedResponse("Unauthorized");
	}
	return { user };
};

export default function ServerAdminLayout() {
	const location = useLocation();

	return (
		<div>
			Admin
			<Outlet />
		</div>
	);
}
