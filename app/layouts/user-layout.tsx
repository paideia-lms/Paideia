import { Outlet } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { UnauthorizedResponse } from "~/utils/responses";
import type { Route } from "./+types/user-layout";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user, responseHeaders, permissions } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!user) {
		throw new UnauthorizedResponse("Unauthorized");
	}
	return {
		user,
	};
};

export default function UserLayout() {
	return (
		<div>
			<div>User Layout</div>
			<Outlet />
		</div>
	);
}
