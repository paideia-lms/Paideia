import type { GetAnnotations } from "react-router/internal";
import { useLoaderData, useMatches } from "react-router";
import type React from "react";
import { forwardRef } from "react";
import type { Jsonifiable } from "type-fest";

/**
 * when using this utility function, you restrict the component to only used in a specific route.
 * The loaderData and matches are merged into props, and the component always supports refs via forwardRef.
 */
export function createRouteComponent<
	T extends GetAnnotations<any, false>["ComponentProps"],
	Props extends Jsonifiable,
	Ref = {},
>(
	component: (
		props: Props,
		context: { loaderData: T["loaderData"]; matches: T["matches"] },
		ref: Ref extends never ? never : React.Ref<Ref>,
	) => React.ReactNode,
): React.ForwardRefExoticComponent<Props & React.RefAttributes<Ref>> {
	return forwardRef<Ref, Props>((props, ref) => {
		const loaderData = useLoaderData<T>();
		const matches = useMatches() as T["matches"];
		return component(
			props as Props,
			{ loaderData, matches },
			ref as Ref extends never ? never : React.Ref<Ref>,
		);
	}) as ReturnType<typeof createRouteComponent<T, Props, Ref>>;
}
