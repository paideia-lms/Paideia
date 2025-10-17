import { Outlet } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import { tryGetContext } from "~/utils/try-get-context";
import type { Route } from "./+types/server-admin-layout";
import { Container } from "@mantine/core";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const contextResult = tryGetContext(context, globalContextKey);

	if (!contextResult.ok) {
		throw new BadRequestResponse("Context not found");
	}

	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	return { user: currentUser };
};

export const ErrorBoundary = ({ error }: { error: Error }) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function ServerAdminLayout() {
	return (
		<Container size="xl" >
			Admin
			<Outlet />
		</Container>
	);
}
