import type {
	BasePayload,
	PayloadRequest,
	RequestContext,
	TypedUser,
} from "payload";
import { Forbidden } from "payload";

import type { Simplify, Subtract, Sum } from "type-fest";

interface BaseUser extends Omit<TypedUser, "avatar"> {}

interface BaseRequest extends Omit<Partial<PayloadRequest>, "user"> {
	user?: BaseUser | null;
}

/**
 * only need either req or user
 */
export interface BaseInternalFunctionArgs {
	payload: BasePayload;
	// user?: Partial<TypedUser> | null;
	req?: BaseRequest;
	overrideAccess?: boolean;
}

/**
 * Intercepts errors from Payload operations and logs them with consistent logging.
 *
 * @param error - The error that occurred
 * @param functionName - Name of the function where the error occurred (for logging)
 * @param context - Additional context about the operation (e.g., "by id 123", "for collection 'users'")
 * @param args - Base internal function args containing payload, user, and logger
 * @returns Transformed error (Forbidden errors are returned as-is, others wrapped in UnknownError)
 */
export function interceptPayloadError({
	error,
	functionNamePrefix,
	args,
}: {
	error: unknown;
	functionNamePrefix: string;
	args: BaseInternalFunctionArgs;
}) {
	const { payload, req } = args;
	const user = req?.user;
	if (error instanceof Forbidden) {
		payload.logger.error(
			`${functionNamePrefix} by user: ${user ? `${user.firstName} ${user.lastName} (id ${user.id})` : "unauthenticated"}`,
		);
	} else
		payload.logger.error(
			`${functionNamePrefix} by user: ${user ? `${user.firstName} ${user.lastName} (id ${user.id})` : "unauthenticated"}`,
		);
}

export function createLocalReq({
	request,
	user,
	context,
}: {
	request: Request;
	user?: TypedUser | null;
	context?: Partial<RequestContext>;
}): Partial<PayloadRequest> {
	return {
		// need to break down the object
		url: request.url,
		headers: request.headers,
		method: request.method,
		body: request.body,
		cache: request.cache,
		_c: request._c,
		arrayBuffer: request.arrayBuffer,
		formData: request.formData,
		json: request.json,
		text: request.text,
		blob: request.blob,
		clone: request.clone,
		redirect: request.redirect,
		referrer: request.referrer,
		signal: request.signal,
		destination: request.destination,
		referrerPolicy: request.referrerPolicy,
		mode: request.mode,
		integrity: request.integrity,
		keepalive: request.keepalive,
		user,
		context,
	};
}

/**
 * helper function to handle depth of payload local api
 *
 * Depth<{ media: number | Media | null | undefined }, 0> // will return { media: number | null | undefined }
 * Depth<{ media: number | Media | null | undefined }, 1> // will return { media: Media | null | undefined }
 *
 * it should also handle nested objects and arrays.
 *
 * Depth<{ media: (number | Media)[] | null | undefined }, 0> // will return { media: (number | null | undefined)[] }
 * Depth<{ media: (number | Media)[] | null | undefined }, 1> // will return { media: (Media | null | undefined)[] }
 *
 * it should also handle recursive objects
 *
 * type User = {
 *  id: number;
 *  avatar: number | Media | null | undefined;
 * }
 *
 * type Media = {
 *  id: number;
 *  createdBy: number | User | null | undefined;
 * }
 *
 * Depth<User, 0> // will return { id: number, avatar: number | null | undefined }
 * Depth<User, 1> // will return { id: number, avatar: { id: number, createdBy: number | null | undefined } | null | undefined }
 * Depth<User, 2> // will return { id: number, avatar: { id: number, createdBy: { id: number , avatar: number | null | undefined } | null | undefined } | null | undefined }
 *
 */
// 1. Configuration
type ID = string | number;

type FollowNullable<IsNullable extends boolean, T> = IsNullable extends true
	? T | null | undefined
	: T;

type IsNullable<T> = T extends null | undefined ? true : false;

// Type of a single Polymorphic Object
type PolymorphicObject = { relationTo: string; value: unknown };

type Doc = { docs?: unknown[] };

// 2. IsRelation: Returns true ONLY if T contains BOTH an ID AND an Object
// We use [] to prevent distribution logic from messing this up.
type IsNormalRelation<T> =
	// --- FIX: Unwrap Array First ---
	// If T (non-nullable) is an array, delegate the check to the item type (U).
	NonNullable<T> extends (infer U)[]
		? IsNormalRelation<U>
		: // --- Original Checks Follow ---
			[Extract<T, ID>] extends [never] // Does it lack an ID?
			? false
			: [Exclude<T, ID | null | undefined>] extends [never] // Does it lack an Object?
				? false
				: // does the object has a id field?
					Exclude<T, ID | null | undefined> extends { id: ID }
					? true
					: false;

type IsPolymorphicRelation<T> = NonNullable<T> extends (infer K)[]
	? IsPolymorphicRelation<K>
	: NonNullable<T> extends { relationTo: string; value: infer U }
		? IsNormalRelation<U>
		: false;

type IsDocRelation<T> = NonNullable<T> extends { docs?: (infer U)[] }
	? IsNormalRelation<U> extends true
		? true
		: IsPolymorphicRelation<U> extends true
			? true
			: false
	: false;

type IsRelation<T> = IsNormalRelation<T> extends true
	? true
	: IsPolymorphicRelation<T> extends true
		? true
		: IsDocRelation<T> extends true
			? true
			: false;

// 3. StripObject: Used when Depth is 0. Keeps IDs and Nulls.
type StripNormalObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
		? Extract<U, ID | null | undefined>[]
		: Extract<T, ID | null | undefined>
>;

// 4. StripID: Used when Depth > 0. Keeps Objects and Nulls.
type StripNormalID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[] ? StripNormalID<U>[] : Exclude<T, ID>
>;

// --- Fix 1: Strip Polmorphic IDs (Keeps Objects) ---
type StripPolymorphicID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
		? StripPolymorphicID<U>[] // Recurse into Array item (U)
		: // Check if T is the Polymorphic Object structure
			NonNullable<T> extends PolymorphicObject
			? // Map over the Polymorphic structure: apply stripping to 'value', keep 'relationTo'
				{
					[K in keyof T]: K extends "value"
						? // Apply stripping logic to the inner relationship value
							Exclude<T[K], ID> // Strip the inner ID (number)
						: T[K]; // Keep relationTo
				}
			: StripNormalID<T>
>; // Fallback to stripping the primitive ID

// --- Fix 2: Strip Polmorphic Objects (Keeps IDs) ---
type StripPolymorphicObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
		? StripPolymorphicObject<U>[] // Recurse into Array item (U)
		: // Check if T is the Polymorphic Object structure
			NonNullable<T> extends PolymorphicObject
			? // Map over the Polymorphic structure: apply stripping to 'value', keep 'relationTo'
				{
					[K in keyof T]: K extends "value"
						? // Apply stripping logic to the inner relationship value
							Extract<T[K], ID | null | undefined> // Extract the inner ID (number)
						: T[K]; // Keep relationTo
				}
			: StripNormalObject<T>
>; // Fallback to extracting the primitive ID

// --- New Type 1: Strip Doc ID (Keep Objects / Populate) ---
// Recursively strips IDs from all relationship types within the 'docs' array of a Doc object.
type StripDocID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
		? StripDocID<U>[] // Handle arrays of Docs
		: NonNullable<T> extends Doc
			? // If T is a Doc, apply stripping logic to the 'docs' field
				{
					[K in keyof T]: K extends "docs"
						? StripPolymorphicID<T[K]> // Apply ID-stripping (Object-keeping) logic to the array contents
						: T[K];
				}
			: StripPolymorphicID<T> // Fallback for general fields that might be simple/polymorphic relations
>;

// --- New Type 2: Strip Doc Object (Keep IDs / Shallow) ---
// Recursively strips Objects from all relationship types within the 'docs' array of a Doc object.
type StripDocObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
		? StripDocObject<U>[] // Handle arrays of Docs
		: NonNullable<T> extends Doc
			? // If T is a Doc, apply stripping logic to the 'docs' field
				{
					[K in keyof T]: K extends "docs"
						? StripPolymorphicObject<T[K]> // Apply Object-stripping (ID-keeping) logic to the array contents
						: T[K];
				}
			: StripPolymorphicObject<T> // Fallback for general fields that might be simple/polymorphic relations
>;

type StripID<T> = IsDocRelation<T> extends true
	? StripDocID<T>
	: IsPolymorphicRelation<T> extends true
		? StripPolymorphicID<T>
		: IsNormalRelation<T> extends true
			? StripNormalID<T>
			: T;

type StripObject<T> = IsDocRelation<T> extends true
	? StripDocObject<T>
	: IsPolymorphicRelation<T> extends true
		? StripPolymorphicObject<T>
		: IsNormalRelation<T> extends true
			? StripNormalObject<T>
			: T;

// Extract depth-0 array handling
type DepthZeroArrayItem<U> = U extends object
	? {
			[K in keyof U]: FollowNullable<
				IsNullable<U[K]>,
				NonNullable<StripObject<U[K]>>
			>;
		}
	: U;

// Extract depth-0 object handling
type DepthZeroObject<T> = {
	[K in keyof T]: NonNullable<T[K]> extends object
		? NonNullable<T[K]> extends (infer U extends object)[]
			? DepthZeroArrayItem<U>[]
			: NonNullable<StripObject<T[K]>>
		: NonNullable<StripObject<T[K]>>;
};

// Extract depth-0 case
type DepthZero<T> = T extends (infer U)[]
	? DepthZeroArrayItem<U>[]
	: T extends object
		? DepthZeroObject<T>
		: StripObject<T>;

// Extract normal relation handling
type DepthNormalRelation<T, D extends number> = Depth<
	NonNullable<StripID<T>>,
	Subtract<D, 1>
>;

// Extract polymorphic relation handling
type DepthPolymorphicRelation<
	T,
	D extends number,
> = NonNullable<T> extends (infer U extends object)[]
	? Depth<NonNullable<StripID<U>>, Subtract<D, 1>>[]
	: {
			[K in keyof T]: K extends "value"
				? Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
				: T[K];
		};

// Extract doc relation handling
type DepthDocRelation<T, D extends number> = {
	[K in keyof T]: K extends "docs"
		? Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
		: T[K];
};

// Extract array handling for depth > 0
type DepthArrayItem<U, D extends number> = U extends object
	? {
			[K in keyof U]: FollowNullable<
				IsNullable<U[K]>,
				Depth<NonNullable<StripID<U[K]>>, Subtract<D, 1>>
			>;
		}
	: U;

// Extract object handling for depth > 0
type DepthObject<T, D extends number> = {
	[K in keyof T]: FollowNullable<
		IsNullable<T[K]>,
		Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
	>;
};

// Extract fallback handling for depth > 0
type DepthFallback<T, D extends number> = T extends (infer U extends object)[]
	? DepthArrayItem<U, D>[]
	: T extends object
		? DepthObject<T, D>
		: T;

// Main Depth type with reduced nesting
export type Depth<T, D extends number = 2> = Simplify<
	FollowNullable<
		IsNullable<T>,
		D extends 0
			? DepthZero<T>
			: IsNormalRelation<T> extends true
				? DepthNormalRelation<T, D>
				: IsPolymorphicRelation<T> extends true
					? DepthPolymorphicRelation<T, D>
					: IsDocRelation<T> extends true
						? DepthDocRelation<T, D>
						: DepthFallback<T, D>
	>
>;

export function stripDepth<
	D extends number,
	f extends
		| "find"
		| "findByID"
		| "create"
		| "update"
		| "delete"
		| "updateGlobal"
		| "findGlobal" = "findByID",
>() {
	return <T>(data: T): Depth<T, f extends "find" ? Sum<D, 1> : D> =>
		data as any;
}

type Primitive =
	| string
	| number
	| boolean
	| symbol
	| null
	| undefined
	| Function;

export type OmitDeep<T, K extends keyof any> = T extends Primitive
	? T
	: T extends (infer U)[] // Handle arrays recursively
		? OmitDeep<U, K>[]
		: {
				// Exclude the keys K at the current level T
				[P in Exclude<
					keyof T,
					K
				>]: // Recursively apply OmitDeep to the property value
				OmitDeep<T[P], K>;
			};

export type PickDeep<T, K extends keyof any> = T extends Primitive
	? T
	: T extends (infer U)[] // Handle arrays recursively
		? PickDeep<U, K>[]
		: {
				// Pick only the keys K at the current level T
				[P in Extract<
					keyof T,
					K
				>]: // Recursively apply PickDeep to the property value
				PickDeep<T[P], K>;
			};

export function omitType<T, K extends keyof T>(
	type: T,
	_keys: K[],
): Omit<T, K> {
	return type as any;
}

export function pickType<T, K extends keyof T>(
	type: T,
	_keys: K[],
): Pick<T, K> {
	return type as any;
}

export function deepOmitType<T, K extends keyof T>(
	type: T,
	_keys: K[],
): OmitDeep<T, K> {
	return type as any;
}

export function deepPickType<T, K extends keyof T>(
	type: T,
	_keys: K[],
): PickDeep<T, K> {
	return type as any;
}
