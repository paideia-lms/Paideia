import type { UseFormReturnType } from "@mantine/form";
import type {
	FormPathValue,
	LooseKeys,
} from "node_modules/@mantine/form/lib/paths.types";
import { useForceUpdate } from "@mantine/hooks";
import { useEffect } from "react";
import { keys } from "es-toolkit/compat";
import { flattenObject } from "es-toolkit";

/**
 * https://github.com/mantinedev/mantine/blob/master/packages/%40mantine/form/src/paths/get-splitted-path.ts
 */
function getSplittedPath(path: unknown) {
	if (typeof path !== "string") {
		return [];
	}

	return path.split(".");
}

/**
 * https://github.com/mantinedev/mantine/blob/master/packages/%40mantine/form/src/paths/get-path.ts#L3
 */
export function getPath<V, T extends LooseKeys<V>>(
	path: T,
	values: V,
): FormPathValue<V, T> {
	const splittedPath = getSplittedPath(path);

	if (
		splittedPath.length === 0 ||
		typeof values !== "object" ||
		values === null
	) {
		return undefined as FormPathValue<V, T>;
	}

	let value = values[splittedPath[0] as keyof typeof values];
	for (let i = 1; i < splittedPath.length; i += 1) {
		if (value == null) {
			break;
		}

		// @ts-expect-error
		value = value[splittedPath[i]];
	}

	return value as FormPathValue<V, T>;
}

export function useFormWatchForceUpdate<Values, T extends LooseKeys<Values>>(
	form: UseFormReturnType<Values>,
	path: T,
	shouldUpdate: (values: {
		previousValue: FormPathValue<Values, T>;
		value: FormPathValue<Values, T>;
		touched: boolean;
		dirty: boolean;
	}) => boolean = () => true,
) {
	const forceUpdate = useForceUpdate();
	form.watch(path, (values) => {
		if (shouldUpdate(values)) {
			forceUpdate();
		}
	});
	return getPath(path, form.getValues());
}

export function triggerFormUpdate<Values, T extends LooseKeys<Values>>(
	form: UseFormReturnType<Values>,
	path: T,
) {
	// this line does not do anything, but it will trigger a re-render at a particular path
	// Explicitly type value as any to avoid expensive FormPathValue type inference
	// This function's purpose is to trigger re-render, not type checking
	const value = getPath(path, form.getValues()) as any;
	form.setFieldValue(path, value, { forceUpdate: true });
}

export function useFormWithSyncedInitialValues<
	T extends Record<string, unknown>,
>(form: UseFormReturnType<T>, initialValues: T) {
	const flattenedInitialValues = flattenObject(initialValues);
	const flattenedInitialValuesKeys = keys(flattenedInitialValues);
	const flattenedInitialValuesDependencies = flattenedInitialValuesKeys.map(
		(key) => flattenedInitialValues[key],
	);

	useEffect(() => {
		form.setInitialValues(initialValues);
		form.reset();
		// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	}, flattenedInitialValuesDependencies);

	return form;
}
