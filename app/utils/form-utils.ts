import type { UseFormReturnType } from "@mantine/form";
import { useState } from "react";
import type {
	FormPathValue,
	LooseKeys,
} from "~/packages/@mantine/form/lib/paths.types";

const isPrimitive = (
	value: unknown,
): value is string | number | boolean | null | undefined =>
	typeof value === "string" ||
	typeof value === "number" ||
	typeof value === "boolean" ||
	value === null ||
	value === undefined;

type UseFormWatchValueOptions<
	Values,
	T extends LooseKeys<Values>,
	DerivedType = FormPathValue<Values, T>,
> = {
	derived?: (value: FormPathValue<Values, T>) => DerivedType;
};

export function useFormWatchValue<
	Values,
	T extends LooseKeys<Values>,
	DerivedType = FormPathValue<Values, T>,
>(
	form: UseFormReturnType<Values>,
	path: T,
	// initialValue: FormPathValue<Values, T>,
	options?: UseFormWatchValueOptions<Values, T, DerivedType>,
): DerivedType {
	const { derived } = options ?? {};
	const initialValue = getPath(path, form.getValues());
	const derivedInitialValue = derived ? derived(initialValue) : initialValue;
	const isInitialPrimitive = isPrimitive(derivedInitialValue);
	const [p, setP] = useState(isInitialPrimitive);
	const [value, setValue] = useState<
		string | number | boolean | null | undefined
	>(
		isInitialPrimitive
			? derivedInitialValue
			: JSON.stringify(derivedInitialValue),
	);
	form.watch(path, (values) => {
		const derivedValue = derived
			? derived(values.value as FormPathValue<Values, T>)
			: values.value;
		const newP = isPrimitive(derivedValue);
		// the set state determine whether the component will re-render
		setP(newP);
		setValue(
			(newP ? derivedValue : JSON.stringify(derivedValue)) as
				| string
				| number
				| boolean
				| null
				| undefined,
		);
	});
	return (p ? value : JSON.parse(value as string)) as DerivedType;
}

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
