import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { useFetcher, useParams } from "react-router";
import type {
	ConditionalPick,
	KeysOfUnion,
	Merge,
	Simplify,
	UnionToIntersection,
} from "type-fest";
import { serverOnly$ } from "vite-env-only/macros";
import { badRequest } from "~/utils/responses";
import { paramsSchema, type ParamsType } from "~/utils/routes-utils";
import { isRequestMethod } from "~/utils/assert-request-method";
import {
	createLoader,
	parseAsStringEnum,
	ParserMap,
	SingleParserBuilder,
} from "nuqs/server";
import { ContentType } from "~/utils/get-content-type";

/**
 * Special marker used to represent null values in FormData.
 * This marker is extremely unlikely to be used by users.
 * If a user needs to send this exact string, they should JSON.stringify it
 * as part of an object, which will escape it properly.
 */
export const NULL_MARKER = "\0__FORM_NULL__\0";

/**
 * Converts FormData (including MyFormData) to a plain object.
 * Handles the special NULL_MARKER, JSON parsing, and preserves Files.
 * This function can be used on both client and server side.
 *
 * @param formData - The FormData instance to convert
 * @returns A plain object with parsed values
 */
export function convertMyFormDataToObject<T = Record<string, unknown>>(
	formData: FormData,
): T {
	const f = Object.fromEntries(formData);
	const data = Object.fromEntries(
		Object.entries(f)
			// Filter out the dummy field added for empty FormData
			.filter(([key]) => key !== "__empty__")
			.map(([key, value]) => {
				// Files should be preserved as-is
				if (value instanceof File) {
					return [key, value];
				}

				const stringValue = value as string;

				// Check if this is our null marker
				if (stringValue === NULL_MARKER) {
					return [key, null];
				}

				// Try to parse as JSON (handles objects, arrays, numbers, booleans, and JSON strings)
				// Falls back to original value if parsing fails
				try {
					const parsed = JSON.parse(stringValue);
					return [key, parsed];
				} catch {
					// Not valid JSON, return as string
					// This shouldn't happen if we're using MyFormData correctly,
					// but handle it gracefully
					return [key, stringValue];
				}
			}),
	) as T;
	return data;
}

export class MyFormData<
	T extends Record<
		string,
		Blob | string | object | boolean | number | null | undefined
	>,
> extends FormData {
	constructor(data: T) {
		super();
		let hasAnyField = false;

		for (const [key, value] of Object.entries(data)) {
			// Skip undefined values (don't append to FormData)
			if (value === undefined) {
				continue;
			}

			hasAnyField = true;

			// Send null as special marker to distinguish from undefined and string "null"
			if (value === null) {
				this.append(key, NULL_MARKER);
				continue;
			}

			// For strings, we need to handle the edge case where string is "null"
			// We JSON.stringify it to preserve it and distinguish from actual null
			if (typeof value === "string") {
				this.append(key, JSON.stringify(value));
				continue;
			}

			this.append(
				key,
				value instanceof Blob
					? value
					: typeof value === "object"
						? JSON.stringify(value)
						: typeof value === "boolean"
							? value.toString()
							: typeof value === "number"
								? value.toString()
								: value,
			);
		}

		// If FormData is empty (all values were undefined or object was empty),
		// add a dummy field to ensure the request is valid
		// This prevents "fail to fetch" errors when submitting empty FormData
		if (!hasAnyField) {
			this.append("__empty__", "true");
		}
	}

	json(): T {
		return convertMyFormDataToObject<T>(this);
	}
}

type PreserveOptionalParams<T extends ActionFunctionArgs> = {
	params: Simplify<
		{
			[K in Extract<
				keyof T["params"],
				keyof ParamsType
			> as undefined extends T["params"][K] ? K : never]?: ParamsType[K];
		} & {
			[K in Extract<
				keyof T["params"],
				keyof ParamsType
			> as undefined extends T["params"][K] ? never : K]: ParamsType[K];
		}
	>;
};

export function typeCreateActionRpc<T extends ActionFunctionArgs>() {
	return <
		Method extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE",
		FormDataSchema extends z.ZodTypeAny | undefined,
		SearchParamsSchema extends ParserMap | undefined,
		Action extends string | undefined = undefined,
	>({
		formDataSchema,
		method = "POST" as Method,
		searchParams,
		action,
	}: {
		formDataSchema?: FormDataSchema;
		method?: Method;
		searchParams?: SearchParamsSchema;
		/**
		 *  if action is provided, it will be merged with searchParams.
		 * it is the shortcut for
		 *
		 * ```
		 * { action: parseAsStringEnum([action]).withDefault(action), ...searchParams }
		 * ```
		 */
		action?: Action;
	} = {}) => {
		// Merge action shortcut with searchParams if both are provided
		const mergedSearchParams = action
			? {
					action: parseAsStringEnum([action]).withDefault(action),
					...(searchParams ?? {}),
				}
			: searchParams;

		const loadSearchParams = mergedSearchParams
			? createLoader(mergedSearchParams)
			: undefined;

		type HasSearchParams = SearchParamsSchema extends Record<string, any>
			? true
			: false;

		type HasAction = Action extends string ? true : false;

		type HasBothSearchParamsAndAction = HasSearchParams extends true
			? HasAction extends true
				? true
				: false
			: false;

		type SearchParamsType = Simplify<
			UnionToIntersection<
				Exclude<
					HasBothSearchParamsAndAction extends true
						? Awaited<ReturnType<NonNullable<typeof loadSearchParams>>>
						: HasAction extends true
							? { action: Action }
							: HasSearchParams extends true
								? Awaited<ReturnType<NonNullable<typeof loadSearchParams>>>
								: never,
					{ action: never }
				>
			>
		>;

		type Params = PreserveOptionalParams<T>;

		type ArgsWithFormData = FormDataSchema extends z.ZodTypeAny
			? Simplify<
					Omit<T, "params" | "request" | "searchParams"> &
						Params & {
							formData: z.infer<FormDataSchema>;
							searchParams: SearchParamsType;
							request: Omit<T["request"], "method"> & { method: Method };
						}
				>
			: Simplify<
					Omit<T, "params" | "request"> &
						Params & {
							searchParams: SearchParamsType;
							request: Omit<T["request"], "method"> & { method: Method };
						}
				>;

		const _action = mergedSearchParams?.action
			.defaultValue as SearchParamsType["action"];
		// console.log({ _action, searchParams, action });

		type OtherSearchParams = Omit<SearchParamsType, "action">;

		return <A extends (args: ArgsWithFormData) => ReturnType<A>>(
			a: A,
			options: {
				action: (
					params: Params["params"],
					searchParams: SearchParamsType,
				) => string;
			},
		) => {
			const action = serverOnly$(async (args: T) => {
				const { params, request } = args;

				// check request method
				if (!isRequestMethod(request.method, method)) {
					return badRequest({
						success: false,
						error: `Method ${request.method} not allowed. Expected ${method}.`,
					});
				}

				// check every params in the schema
				for (const [key, value] of Object.entries(params)) {
					const result =
						paramsSchema[key as keyof typeof paramsSchema].safeParse(value);
					if (!result.success) {
						return badRequest({
							success: false,
							error: z.prettifyError(result.error),
						});
					}
				}

				// parse search params if schema is provided
				const parsedSearchParams = loadSearchParams
					? loadSearchParams(request)
					: undefined;

				// parse form data if schema is provided
				if (formDataSchema) {
					const parsed = await request
						.formData()
						.then(convertMyFormDataToObject)
						.then(formDataSchema.safeParse);

					if (!parsed.success) {
						return badRequest({
							success: false,
							error: z.prettifyError(parsed.error),
						});
					}

					return a({
						...args,
						request: {
							...request,
							method: method as Method,
						},
						...(parsedSearchParams !== undefined
							? { searchParams: parsedSearchParams }
							: {}),
						formData: parsed.data,
					} as unknown as ArgsWithFormData);
				}

				return a({
					...args,
					request: {
						...request,
						method: method as Method,
					},
					...(parsedSearchParams !== undefined
						? { searchParams: parsedSearchParams }
						: {}),
				} as unknown as ArgsWithFormData);
			})!;

			const hook = () => {
				const fetcher = useFetcher<ReturnType<A>>();

				const submit = async (
					args: Simplify<
						{
							params: Params["params"];
							values: z.infer<FormDataSchema>;
						} & (keyof OtherSearchParams extends never // if there are no other search params, searchParams can be optional
							? { searchParams?: OtherSearchParams }
							: { searchParams: OtherSearchParams })
					>,
				) => {
					const url = options.action(args.params, {
						...("searchParams" in args ? args.searchParams : {}),
						action: _action,
					} as unknown as SearchParamsType);

					await fetcher.submit(
						new MyFormData(
							args.values as Record<
								string,
								string | number | boolean | object | Blob | null | undefined
							>,
						),
						{
							method,
							action: url,
							encType: ContentType.MULTIPART,
						},
					);
				};

				return {
					submit,
					isLoading: fetcher.state !== "idle",
					data: fetcher.data,
					fetcher,
				};
			};

			// change the
			return [action, hook] as const;
		};
	};
}
