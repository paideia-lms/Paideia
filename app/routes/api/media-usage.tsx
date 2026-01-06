import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindMediaUsages } from "server/internal/media-management";
import { badRequest, ok, unauthorized } from "~/utils/responses";
import { typeCreateLoaderRpc } from "~/utils/loader-utils";
import type { Route } from "./+types/media-usage";

const createLoaderRpc = typeCreateLoaderRpc<Route.LoaderArgs>({
	route: "/api/media-usage/:mediaId",
});

const loaderRpc = createLoaderRpc({});

export const loader = loaderRpc.createLoader(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			// throw new NotFoundResponse("Unauthorized");
			return unauthorized("Unauthorized");
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized("Unauthorized");
		}

		const { mediaId } = params;

		const result = await tryFindMediaUsages({
			payload,
			mediaId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({
			usages: result.value.usages,
			totalUsages: result.value.totalUsages,
		});
	},
);

export const useMediaUsageData = loaderRpc.createHook<typeof loader>();


