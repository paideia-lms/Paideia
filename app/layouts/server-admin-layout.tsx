import { Outlet } from "react-router";
import { dbContextKey } from "server/contexts/global-context";
import { BadRequestResponse, UnauthorizedResponse } from "~/utils/responses";
import { tryGetContext } from "~/utils/try-get-context";
import type { Route } from "./+types/server-admin-layout";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const contextResult = tryGetContext(context, dbContextKey);

	if (!contextResult.ok) {
		throw new BadRequestResponse("Context not found");
	}

	const { payload } = contextResult.value;

	const { user } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user || user.role !== "admin") {
		throw new UnauthorizedResponse("Unauthorized");
	}
	return { user };
};

export default function ServerAdminLayout() {
	return (
		<div>
			Admin
			<Outlet />
		</div>
	);
}
