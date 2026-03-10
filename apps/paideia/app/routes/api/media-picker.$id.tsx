import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	unauthorized,
} from "app/utils/router/responses";
import { typeCreateLoaderRpc } from "app/utils/router/loader-utils";
import { permissions } from "@paideia/paideia-backend";
import type { Route } from "./+types/media-picker.$id";

const createLoaderRpc = typeCreateLoaderRpc<Route.LoaderArgs>({
	route: "/api/media-picker/:id",
});

const loaderRpc = createLoaderRpc({});

export const loader = loaderRpc.createLoader(async ({ context, params }) => {
	const { paideia, systemGlobals, requestContext } =
		context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized("Unauthorized");
	}

	const userId = params.id;

	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only access your own media");
	}

	const storageLimit = systemGlobals.sitePolicies.userMediaStorageTotal;
	const uploadLimit = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	const mediaResult = await paideia.tryFindMediaByUser({
		userId,
		limit: 50,
		page: 1,
		depth: 0,
		req: requestContext,
	});

	if (!mediaResult.ok) {
		throw new NotFoundResponse("Failed to fetch media");
	}

	const mediaWithPermissions = mediaResult.value.docs.map((file) => {
		const deletePermission = permissions.media.canDelete(
			currentUser,
			file.createdBy.id,
		);
		return {
			...file,
			deletePermission,
		};
	});

	const stats = await paideia
		.tryGetUserMediaStats({
			userId,
			req: requestContext,
		})
		.getOrNull();

	return ok({
		media: mediaWithPermissions,
		stats,
		storageLimit,
		uploadLimit,
	});
});

export const useMediaPickerData = loaderRpc.createHook<typeof loader>();
