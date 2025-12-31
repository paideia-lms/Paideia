import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindMediaUsages } from "server/internal/media-management";
import { badRequest, NotFoundResponse, ok } from "~/utils/responses";
import { typeCreateLoaderRpc } from "~/utils/loader-utils";
import type { Route } from "./+types/media-usage";
import { serverOnly$ } from "vite-env-only/macros";

// const paramsSchema = z.object({
// 	mediaId: z.union([z.number(), z.string()]).transform((val) => {
// 		if (typeof val === "string") {
// 			const parsed = Number.parseInt(val, 10);
// 			if (Number.isNaN(parsed)) {
// 				throw new z.ZodError([
// 					{
// 						code: "custom",
// 						path: ["mediaId"],
// 						message: "Media ID must be a valid number",
// 					},
// 				]);
// 			}
// 			return parsed;
// 		}
// 		return val;
// 	}),
// });

const createLoaderRpc = typeCreateLoaderRpc<Route.LoaderArgs>();

const [loaderFn, useMediaUsageData] = createLoaderRpc({})(serverOnly$(async ({ context, params }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	const { mediaId } = params;
	console.log(mediaId);

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
})!, {
	getRouteUrl: ( { params } ) => href("/api/media-usage/:mediaId", {
		mediaId: params.mediaId.toString(),
	}),
});

export const loader = loaderFn;

export { useMediaUsageData };