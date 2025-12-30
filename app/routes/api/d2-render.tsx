import { useEffect, useCallback } from "react";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { isD2Available } from "server/utils/cli-dependencies-check";
import { z } from "zod";
import { renderD2ToSvg } from "~/utils/d2-render";
import { badRequest } from "~/utils/responses";
import type { Route } from "./+types/d2-render";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createRenderD2ActionRpc = createActionRpc({
	formDataSchema: z.object({
		code: z.string().min(1, "D2 code cannot be empty"),
	}),
	method: "POST",
});

export function getRouteUrl() {
	return href("/api/d2-render");
}

const [renderD2Action, useRenderD2] = createRenderD2ActionRpc(
	serverOnly$(async ({ context, formData }) => {
		// Check if D2 CLI is available
		const d2Available = await isD2Available();
		if (!d2Available) {
			return badRequest({
				error:
					"D2 CLI is not installed. Please install D2 CLI to use this feature.",
			});
		}

		const { unstorage } = context.get(globalContextKey);

		try {
			const svg = await renderD2ToSvg(formData.code, unstorage);
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
	})!,
	{
		action: getRouteUrl,
	},
);

// Export hook for use in components
export { useRenderD2 };

export const action = renderD2Action;

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
	const { submit, isLoading, data, fetcher } = useRenderD2();

	// ? don't know why we need to use useCallback here
	const renderD2 = useCallback(
		(code: string) => {
			submit({
				values: {
					code,
				},
			});
		},
		[submit],
	);

	// Extract SVG from successful response
	const svg =
		data && typeof data === "object" && "svg" in data
			? (data as { svg: string }).svg
			: null;

	// Extract error from failed response
	const error =
		data && typeof data === "object" && "error" in data
			? typeof (data as { error: string }).error === "string"
				? (data as { error: string }).error
				: JSON.stringify((data as { error: unknown }).error)
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
		loading: isLoading,
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

	const data = (await response.json()) as { svg: string } | { error: string };

	return data;
}
