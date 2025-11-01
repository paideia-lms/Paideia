import { useCallback } from "react";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { isD2Available } from "server/utils/cli-dependencies-check";
import z from "zod";
import { renderD2ToSvg } from "~/utils/d2-render";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest } from "~/utils/responses";
import type { Route } from "./+types/d2-render";

const inputSchema = z.object({
	code: z.string().min(1, "D2 code cannot be empty"),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
	// Check if D2 CLI is available
	const d2Available = await isD2Available();
	if (!d2Available) {
		return badRequest({
			error:
				"D2 CLI is not installed. Please install D2 CLI to use this feature.",
		});
	}

	const { unstorage } = context.get(globalContextKey);
	const { data } = await getDataAndContentTypeFromRequest(request);

	const parsed = inputSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({ error: z.treeifyError(parsed.error) });
	}

	const { code } = parsed.data;

	try {
		const svg = await renderD2ToSvg(code, unstorage);
		return { svg };
	} catch (error) {
		console.error("Error processing D2 code:", error);
		return badRequest({
			error:
				error instanceof Error
					? `Error processing D2 code: ${error.message}`
					: "Unknown error processing D2 code",
		});
	}
};

export interface UseD2DiagramOptions {
	onSuccess?: (svg: string) => void;
	onError?: (error: string) => void;
}

/**
 * Custom hook for rendering D2 diagrams via the backend API
 *
 * @example
 * ```tsx
 * const { renderD2, svg, loading, error } = useD2Diagram();
 *
 * // Render a diagram
 * renderD2("x -> y: hello world");
 *
 * // Display the result
 * {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
 * ```
 */
export function useD2Diagram(options: UseD2DiagramOptions = {}) {
	const fetcher = useFetcher<typeof action>();

	const renderD2 = useCallback(
		(code: string) => {
			fetcher.submit(
				{ code },
				{
					method: "POST",
					action: href("/api/d2-render"),
					encType: "application/json",
				},
			);
		},
		[fetcher],
	);

	// Extract SVG from successful response
	const svg = fetcher.data && "svg" in fetcher.data ? fetcher.data.svg : null;

	// Extract error from failed response
	const error =
		fetcher.data && "error" in fetcher.data
			? typeof fetcher.data.error === "string"
				? fetcher.data.error
				: JSON.stringify(fetcher.data.error)
			: null;

	// Call callbacks when status changes
	if (svg && options.onSuccess) {
		options.onSuccess(svg);
	}
	if (error && options.onError) {
		options.onError(error);
	}

	return {
		renderD2,
		svg,
		loading: fetcher.state !== "idle",
		error,
		state: fetcher.state,
	};
}

export async function renderD2(code: string) {
	const response = await fetch(href("/api/d2-render"), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ code }),
	});

	const data = (await response.json()) as Promise<
		{ svg: string } | { error: string }
	>;

	return data;
}
