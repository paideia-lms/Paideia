import type { GetAnnotations } from "react-router/internal";
import { useLoaderData, useMatches } from "react-router";
import type { JSX } from "react/jsx-runtime";

/**
 * when using this utility function, you restrict the component to only used in a specific route.
 */
export function createRouteComponent<
	T extends GetAnnotations<any, false>["ComponentProps"],
	Props extends object,
>(
	component: (
		props: Props,
		{ loaderData }: { loaderData: T["loaderData"]; matches: T["matches"] },
	) => JSX.Element,
): (props: Props) => JSX.Element {
	return (props: Props) => {
		const loaderData = useLoaderData<T>();
		const matches = useMatches() as T["matches"];
		return component(props, { loaderData, matches });
	};
}
