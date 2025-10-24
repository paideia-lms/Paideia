import type { UseFormReturnType } from "@mantine/form";
import type {
  LooseKeys,
  FormPathValue,
} from "~/packages/@mantine/form/lib/paths.types";
import { useState } from "react";

const isPrimitive = (
  value: unknown,
): value is string | number | boolean | null | undefined =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null ||
  value === undefined;

type UseFormWatchValueOptions<Values, T extends LooseKeys<Values>, DerivedType = FormPathValue<Values, T>> = {
  derived?: (value: FormPathValue<Values, T>) => DerivedType
};

export function useFormWatchValue<
  Values,
  T extends LooseKeys<Values>,
  DerivedType = FormPathValue<Values, T>
>(
  form: UseFormReturnType<Values>,
  path: T,
  initialValue: FormPathValue<Values, T>,
  options?: UseFormWatchValueOptions<Values, T, DerivedType>,
): DerivedType {
  const { derived } = options ?? {};
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
