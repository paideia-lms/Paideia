import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { useFetcher, href } from "react-router";
import type { Simplify, UnionToIntersection } from "type-fest";
import { serverOnly$ } from "vite-env-only/macros";
import { badRequest } from "~/utils/responses";
import { paramsSchema, type ParamsType } from "./route-params-schema";
import {
	createLoader,
	parseAsStringEnum,
	type ParserMap,
	type inferParserType,
} from "nuqs/server";
import { ContentType } from "~/utils/get-content-type";
import type { RouteIdFromRouteFunctionArgs, RoutePage } from "./routes-utils";
import { stringify } from "qs";

/**
 * Makes a property optional if the type has no keys, required otherwise.
 * Useful for conditional property requirements based on type emptiness.
 */
type OptionalIfEmpty<T, Key extends string> = keyof T extends never
	? { [K in Key]?: T }
	: { [K in Key]: T };

/**
 * Special marker used to represent explicit null values.
 */
const NULL_MARKER = "\0__FORM_NULL__\0";

/**
 * Prefix for keys used to store extracted Blobs in the FormData.
 * We use a null character and specific prefix to avoid collisions with user data.
 */
const BLOB_REF_PREFIX = "\0__BLOB_REF__:";

/**
 * Helper to generate a unique ID for blobs.
 */
function generateBlobId(): string {
	return `${BLOB_REF_PREFIX}${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function isRequestMethod<T extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE">(
	method: string,
	target: T,
): method is Lowercase<T> | T {
	return method.toUpperCase() === target;
}

/**
 * Checks if a string is a blob reference.
 * Handles both with and without null character prefix (FormData may normalize keys).
 * Also handles escaped null characters (\u0000) that may appear after JSON serialization.
 */
function isBlobRef(value: any): value is string {
	if (typeof value !== "string") return false;
	// Check for actual null character prefix
	if (value.startsWith(BLOB_REF_PREFIX)) return true;
	// Check for escaped null character (\u0000) after JSON.parse
	if (value.charCodeAt(0) === 0 && value.length > 1 && value[1] === "_")
		return true;
	// Check for literal escaped null (\u0000)
	if (value.startsWith("\\u0000__BLOB_REF__:")) return true;
	// Check for normalized key without null character
	if (value.startsWith("__BLOB_REF__:")) return true;
	// Also check if it contains the pattern (in case of any other normalization)
	return /^[\0\\u0000]?__BLOB_REF__:/.test(value);
}

export function normalizeBlobRef(data: string): string {
	if (data.charCodeAt(0) === 0 && data.startsWith(BLOB_REF_PREFIX)) {
		// Remove the first null character
		return data.slice(1);
	}
	if (data.startsWith("__BLOB_REF__:")) {
		return BLOB_REF_PREFIX + data.slice(2);
	}
	return data.slice(6);
}

/**
 * Recursively traverses an object to restore Blobs from the FormData
 * by matching the unique reference IDs.
 */
function restoreBlobsInObject(data: any, formData: FormData): any {
	if (!data) return data;

	if (Array.isArray(data)) {
		return data.map((item) => restoreBlobsInObject(item, formData));
	}

	if (typeof data === "object") {
		// If it's a plain object, recurse through values
		const restored: any = {};
		for (const [key, value] of Object.entries(data)) {
			restored[key] = restoreBlobsInObject(value, formData);
		}
		return restored;
	}

	// Check if this primitive value is actually a reference to a Blob
	if (isBlobRef(data)) {
		// Normalize the reference to consistent format without null character
		const normalizedRef = normalizeBlobRef(data);

		// Try to get the blob using the FormData key format. Try both format.
		// ! for some reason, in bun test, format 2 will work. in react router, format 1 will work
		const blob = formData.get(normalizedRef);
		const blob2 = formData.get("\0" + normalizedRef);

		// If we found the blob, return it. Otherwise (rare error case), keep string.
		return blob instanceof Blob ? blob : blob2 instanceof Blob ? blob2 : data;
	}

	return data;
}

/**
 * Converts FormData (including MyFormData) to a plain object.
 * Handles NULL_MARKER, JSON parsing, and recursively restores Blobs.
 */
export function convertMyFormDataToObject<T = Record<string, unknown>>(
	formData: FormData,
): T {
	const result: any = {};
	const entries = formData.entries() as unknown as [string, string | Blob][];

	// 1. Iterate over all entries in the FormData
	for (const [key, value] of entries) {
		// Skip the internal fields (Blobs stored by ID and empty markers)
		if (key === "__empty__" || isBlobRef(key)) {
			continue;
		}

		let parsedValue: any = value;

		// 2. Handle Files/Blobs directly appended (not through MyFormData)
		if (value instanceof Blob) {
			result[key] = value;
			continue;
		}

		// 3. Handle Top-Level Nulls
		if (value === NULL_MARKER) {
			parsedValue = null;
		}
		// 4. Handle JSON Strings (Everything else is stored as JSON)
		else if (typeof value === "string") {
			try {
				parsedValue = JSON.parse(value);
			} catch {
				// Fallback for non-JSON simple strings
				parsedValue = value;
			}
		}

		// 5. Recursively restore Blobs within the parsed structure
		// This finds any "__BLOB_REF__:xyz" strings and replaces them with the actual File
		result[key] = restoreBlobsInObject(parsedValue, formData);
	}

	return result as T;
}

/**
 * Helper to traverse data, extract Blobs, and replace them with reference strings.
 * Returns the "clean" data and a Map of extracted Blobs.
 */
function extractBlobsAndReplace(
	data: any,
	extractedBlobs: Map<string, Blob>,
): any {
	if (data === undefined) return undefined;

	// 1. Found a Blob!
	if (data instanceof Blob) {
		const refId = generateBlobId();
		extractedBlobs.set(refId, data);
		return refId; // Replace the Blob with its Reference ID in the object tree
	}

	// 2. Handle Arrays
	if (Array.isArray(data)) {
		return data.map((item) => extractBlobsAndReplace(item, extractedBlobs));
	}

	// 3. Handle Objects (excluding null)
	if (data !== null && typeof data === "object") {
		const cleanObj: any = {};
		for (const [key, value] of Object.entries(data)) {
			const cleanValue = extractBlobsAndReplace(value, extractedBlobs);
			if (cleanValue !== undefined) {
				cleanObj[key] = cleanValue;
			}
		}
		return cleanObj;
	}

	// 4. Return primitives as-is
	return data;
}

/**
 * Custom FormData class that handles Blobs and JSON serialization/deserialization.
 * @knipignore
 */
export class MyFormData<T extends Record<string, any>> extends FormData {
	constructor(data: T) {
		super();
		let hasAnyField = false;

		for (const [key, value] of Object.entries(data)) {
			if (value === undefined) continue;
			hasAnyField = true;

			// Handle explicit null
			if (value === null) {
				this.append(key, NULL_MARKER);
				continue;
			}

			// Extract Blobs from the value (deeply)
			const extractedBlobs = new Map<string, Blob>();
			const cleanValue = extractBlobsAndReplace(value, extractedBlobs);

			// 1. Append the extracted Blobs to the root of FormData
			// These act as a "sidecar" storage for the binaries
			for (const [refId, blob] of extractedBlobs) {
				this.append(refId, blob);
			}

			// 2. Append the structure (now containing reference strings instead of Blobs)
			// We stringify it so types (boolean, number) are preserved distinct from strings
			this.append(key, JSON.stringify(cleanValue));
		}

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

/**
 * The hook automatically derives the URL from the routeId using getRouteUrl.
 *
 * @example
 * ```ts
 * const createActionRpc = typeCreateActionRpcV2<Route.ActionArgs>({
 *   routeId: "routes/course.$id.grades"
 * });
 *
 * const createItemRpc = createActionRpc({
 *   formDataSchema: z.object({ name: z.string() }),
 *   method: "POST",
 *   action: Action.CreateItem,
 * });
 *
 * const createItemAction = createItemRpc.createAction(async ({ formData, params }) => {
 *   // action implementation
 * });
 *
 * const useCreateItem = createItemRpc.createHook<typeof createItemAction>();
 * ```
 */
export function typeCreateActionRpc<T extends ActionFunctionArgs>({
	route,
}: {
	route: RoutePage<RouteIdFromRouteFunctionArgs<T>>;
}) {
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

		// Compute SearchParamsType (preserving original logic for correctness)
		type HasSearchParams =
			SearchParamsSchema extends Record<string, unknown> ? true : false;
		type HasAction = Action extends string ? true : false;
		type HasBoth = HasSearchParams extends true
			? HasAction extends true
				? true
				: false
			: false;

		type SearchParamsType = Simplify<
			UnionToIntersection<
				Exclude<
					HasBoth extends true
						? inferParserType<NonNullable<typeof mergedSearchParams>>
						: HasAction extends true
							? { action: Action }
							: HasSearchParams extends true
								? inferParserType<NonNullable<SearchParamsSchema>>
								: never,
					{ action: never }
				>
			>
		>;

		type Params = PreserveOptionalParams<T>;

		// Base args structure
		type BaseArgs = Omit<T, "params" | "request" | "searchParams"> &
			Params & {
				searchParams: SearchParamsType;
				request: Omit<T["request"], "method"> & { method: Method };
			};

		// Args with formData when schema is provided
		type ArgsWithFormData = FormDataSchema extends z.ZodTypeAny
			? Simplify<BaseArgs & { formData: z.infer<FormDataSchema> }>
			: Simplify<BaseArgs>;

		const _action = mergedSearchParams?.action.defaultValue;

		type OtherSearchParams = SearchParamsType extends never
			? // biome-ignore lint/complexity/noBannedTypes: it is intented
				{}
			: Omit<SearchParamsType, "action">;

		return {
			createAction: <A extends (args: ArgsWithFormData) => ReturnType<A>>(
				a: A,
			) => {
				const actionFn = serverOnly$((args: T) => {
					const { params, request } = args;

					// check request method
					if (!isRequestMethod(request.method, method)) {
						return badRequest({
							success: false,
							error: `Method ${request.method} not allowed. Expected ${method}.`,
						});
					}

					// parse and validate custom params schema if provided
					const _params: Record<string, string | number | undefined> = {};

					for (const [key, value] of Object.entries(params)) {
						const schema = paramsSchema[key as keyof typeof paramsSchema];
						if (schema) {
							const result = schema.safeParse(value);
							if (!result.success) {
								return badRequest({
									success: false,
									error: z.prettifyError(result.error),
								});
							}
							_params[key] = result.data;
						} else {
							_params[key] = value;
						}
					}

					// parse search params if schema is provided
					const parsedSearchParams = loadSearchParams
						? loadSearchParams(request)
						: undefined;

					// Build base args object
					const baseArgs = {
						...args,
						params: _params,
						request: request as Omit<T["request"], "method"> & {
							method: Method;
						},
						...(parsedSearchParams !== undefined
							? { searchParams: parsedSearchParams }
							: {}),
					} as unknown as BaseArgs;

					// parse form data if schema is provided
					if (formDataSchema) {
						return request
							.formData()
							.then(convertMyFormDataToObject)
							.then(formDataSchema.safeParse)
							.then((parsed) => {
								if (!parsed.success) {
									return badRequest({
										success: false,
										error: z.prettifyError(parsed.error),
									});
								}
								return a({
									...baseArgs,
									formData: parsed.data,
								} as unknown as ArgsWithFormData);
							});
					}

					return a(baseArgs as unknown as ArgsWithFormData);
				})!;

				return actionFn;
			},
			createHook: <ActionType extends (args: any) => any>() => {
				return () => {
					const fetcher = useFetcher<ActionType>();

					const submit = async (
						args: Simplify<
							OptionalIfEmpty<z.infer<FormDataSchema>, "values"> &
								OptionalIfEmpty<OtherSearchParams, "searchParams"> &
								OptionalIfEmpty<Params["params"], "params">
						>,
					) => {
						const providedSearchParams =
							"searchParams" in args ? args.searchParams : {};
						const providedParams = "params" in args ? args.params : {};

						// Build URL using href with routeId and params
						const baseUrl = href(
							route as any,
							...(providedParams ? [providedParams] : []),
						);

						// Add search params including action
						const allSearchParams = {
							...providedSearchParams,
							...(action ? { action: _action } : {}),
						} as unknown as SearchParamsType;

						const url =
							Object.keys(allSearchParams).length > 0
								? baseUrl + "?" + stringify(allSearchParams)
								: baseUrl;

						await fetcher.submit(
							new MyFormData(
								(args.values ?? {}) as Record<
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
						/**
						 * payload is the submitted form data as an object
						 * it is useful for optimistic updates
						 * @example
						 * ```ts
						 * const { payload } = useSubmit();
						 * if (payload) {
						 *   // do something with the payload
						 * }
						 * ```
						 * see https://reactrouter.com/start/framework/pending-ui#optimistic-ui
						 */
						payload: fetcher.formData
							? convertMyFormDataToObject<z.infer<FormDataSchema>>(
									fetcher.formData,
								)
							: undefined,
					};
				};
			},
		};
	};
}

/**
 * Creates a type-safe action map handler that automatically:
 * 1. Extracts action keys from the map to create search params
 * 2. Creates a loader for the action search param
 * 3. Returns an action function that routes to the correct handler
 *
 * @example
 * ```ts
 * const [action, loadSearchParams] = createActionMap({
 *   [Action.GrantAccess]: grantAccessAction,
 *   [Action.RevokeAccess]: revokeAccessAction,
 * });
 *
 * export { action, loadSearchParams };
 * ```
 */
export function createActionMap<
	ActionMap extends Record<string, (args: any) => any>,
>(actionMap: ActionMap) {
	// Extract action keys from the map
	const actionKeys = Object.keys(actionMap) as Array<keyof ActionMap & string>;

	// Create search params with action enum
	const actionSearchParams = {
		action: parseAsStringEnum(actionKeys),
	};

	// Create loader for search params
	const loadSearchParams = createLoader(actionSearchParams);

	// Infer the common argument type from the action handlers
	// Extract the argument type from the first handler
	type FirstHandler = ActionMap[keyof ActionMap];
	type ActionArgs = FirstHandler extends (args: infer A) => any ? A : never;

	// Return the action function
	// The return type is a union of all possible return types from action handlers
	type ActionReturnType = ReturnType<ActionMap[keyof ActionMap]>;

	const action = (args: ActionArgs): ActionReturnType => {
		// Type assertion needed because ActionArgs might not have request in its type
		// but all ActionFunctionArgs should have it
		const request = (args as { request: Request }).request;
		const { action: actionType } = loadSearchParams(request);

		if (!actionType) {
			return badRequest({
				success: false,
				error: "Action is required",
			}) as unknown as ActionReturnType;
		}

		const actionHandler = actionMap[actionType];
		if (!actionHandler) {
			return badRequest({
				success: false,
				error: "Invalid action",
			}) as unknown as ActionReturnType;
		}

		return actionHandler(args as any) as unknown as ActionReturnType;
	};

	return [action, loadSearchParams] as const;
}
