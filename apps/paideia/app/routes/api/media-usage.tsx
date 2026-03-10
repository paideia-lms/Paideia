import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { badRequest, ok, unauthorized } from "app/utils/router/responses";
import { typeCreateLoaderRpc } from "app/utils/router/loader-utils";
import type { Route } from "./+types/media-usage";

const createLoaderRpc = typeCreateLoaderRpc<Route.LoaderArgs>({
	route: "/api/media-usage/:mediaId",
});

const loaderRpc = createLoaderRpc({});

export const loader = loaderRpc.createLoader(async ({ context, params }) => {
	const { paideia, requestContext } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized("Unauthorized");
	}

	const { mediaId } = params;

	const result = await paideia.tryFindMediaUsages({
		mediaId,
		req: requestContext,
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return ok({
		usages: result.value.usages,
		totalUsages: result.value.totalUsages,
	});
});

export const useMediaUsageData = loaderRpc.createHook<typeof loader>();
