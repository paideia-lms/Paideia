import { type EffectCallback, useEffect } from "react";
import { keys } from "es-toolkit/compat";
import { flattenObject } from "es-toolkit";

export function useEffectForAnyObject<T extends Record<string, unknown>>(
	effect: EffectCallback,
	dependencies: T,
) {
	const flattenedDependencies = flattenObject(dependencies);
	const flattenedDependenciesKeys = keys(flattenedDependencies);
	const flattenedDependenciesValues = flattenedDependenciesKeys.map(
		(key) => flattenedDependencies[key],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: we intentionally depend on the flattened scalar initial values instead of the full initialValues object identity to avoid unnecessary re-renders while still updating when any initial value actually changes
	useEffect(effect, flattenedDependenciesValues);
}
