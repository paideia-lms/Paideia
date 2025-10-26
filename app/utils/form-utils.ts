import type { UseFormReturnType } from "@mantine/form";
import { useForceUpdate } from "@mantine/hooks";
import type {
	FormPathValue,
	LooseKeys,
} from "~/packages/@mantine/form/lib/paths.types";


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


export function useFormWatchForceUpdate<
	Values,
	T extends LooseKeys<Values>,
>(
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
		// @ts-ignore
		if (shouldUpdate(values)) {
			forceUpdate();
		}
	});
	return getPath(path, form.getValues());
}

export function triggerFormUpdate<Values, T extends LooseKeys<Values>>(form: UseFormReturnType<Values>, path: T) {
	// this line does not do anything, but it will trigger a re-render at a particular path
	const value = getPath(path, form.getValues());
	// @ts-ignore
	form.setFieldValue(path, value, { forceUpdate: true });
}