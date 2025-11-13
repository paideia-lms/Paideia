import { useCallback } from "react";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindMediaUsages } from "server/internal/media-management";
import z from "zod";
import { badRequest, NotFoundResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/media-usage";

const inputSchema = z.object({
	mediaId: z.union([z.number(), z.string()]).transform((val) => {
		if (typeof val === "string") {
			const parsed = Number.parseInt(val, 10);
			if (Number.isNaN(parsed)) {
				throw new z.ZodError([
					{
						code: "custom",
						path: ["mediaId"],
						message: "Media ID must be a valid number",
					},
				]);
			}
			return parsed;
		}
		return val;
	}),
});

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Get mediaId from URL params
	const mediaIdParam = params.mediaId;
	if (!mediaIdParam) {
		return badRequest({ error: "Media ID is required" });
	}

	const parsed = inputSchema.safeParse({ mediaId: mediaIdParam });

	if (!parsed.success) {
		return badRequest({ error: z.prettifyError(parsed.error) });
	}

	const { mediaId } = parsed.data;

	const result = await tryFindMediaUsages({
		payload,
		mediaId,
		user: {
			...currentUser,
			collection: "users",
			avatar: currentUser.avatar?.id,
		},
	});

	if (!result.ok) {
		return badRequest({ error: result.error.message });
	}

	return ok({
		usages: result.value.usages,
		totalUsages: result.value.totalUsages,
	});
};

export interface UseMediaUsageDataOptions {
	onSuccess?: (data: {
		usages: Array<{
			collection: string;
			documentId: number;
			fieldPath: string;
		}>;
		totalUsages: number;
	}) => void;
	onError?: (error: string) => void;
}

/**
 * Custom hook for fetching media usage data via the backend API
 *
 * @example
 * ```tsx
 * const { fetchMediaUsage, data, loading, error } = useMediaUsageData();
 *
 * // Fetch usage for a media file
 * fetchMediaUsage(123);
 *
 * // Display the result
 * {data && (
 *   <div>
 *     <p>Total usages: {data.totalUsages}</p>
 *     <ul>
 *       {data.usages.map((usage, i) => (
 *         <li key={i}>
 *           {usage.collection} - {usage.fieldPath}
 *         </li>
 *       ))}
 *     </ul>
 *   </div>
 * )}
 * ```
 */
export function useMediaUsageData(options: UseMediaUsageDataOptions = {}) {
	const fetcher = useFetcher<typeof loader>();

	const fetchMediaUsage = useCallback(
		(mediaId: number | string) => {
			fetcher.load(
				href("/api/media-usage/:mediaId", {
					mediaId: mediaId.toString(),
				}),
			);
		},
		[fetcher],
	);

	// Extract data from successful response
	const data =
		fetcher.data && "usages" in fetcher.data && "totalUsages" in fetcher.data
			? {
					usages: fetcher.data.usages,
					totalUsages: fetcher.data.totalUsages,
				}
			: null;

	// Extract error from failed response
	const error =
		fetcher.data && "error" in fetcher.data
			? typeof fetcher.data.error === "string"
				? fetcher.data.error
				: JSON.stringify(fetcher.data.error)
			: null;

	// Call callbacks when status changes
	if (data && options.onSuccess) {
		options.onSuccess(data);
	}
	if (error && options.onError) {
		options.onError(error);
	}

	return {
		fetchMediaUsage,
		data,
		loading: fetcher.state !== "idle",
		error,
		state: fetcher.state,
	};
}
