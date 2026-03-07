import type {
	BasePayload,
	PayloadRequest,
	RequestContext,
	TypedUser,
} from "payload";
import type { Simplify, Subtract, Sum } from "type-fest";

interface BaseUser extends Omit<TypedUser, "avatar"> { }

interface BaseRequest extends Omit<Partial<PayloadRequest>, "user"> {
	user?: BaseUser | null;
}

/**
 * only need either req or user
 */
export interface BaseInternalFunctionArgs {
	payload: BasePayload;
	req: BaseRequest | undefined;
	overrideAccess?: boolean;
}

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
	payload.logger.error(
		`${functionNamePrefix} by user: ${user ? `${"firstName" in user ? user.firstName : ""} ${"lastName" in user ? user.lastName : ""} (id ${user.id})` : "unauthenticated"}`,
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
		url: request.url,
		headers: request.headers,
		method: request.method,
		body: request.body,
		cache: request.cache,
		...("_c" in request && { _c: (request as Request & { _c?: unknown })._c }),
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

type ID = string | number;
type FollowNullable<IsNullable extends boolean, T> = IsNullable extends true
	? T | null | undefined
	: T;
type IsNullable<T> = T extends null | undefined ? true : false;
type PolymorphicObject = { relationTo: string; value: unknown };
type Doc = { docs?: unknown[] };

type IsNormalRelation<T> =
	NonNullable<T> extends (infer U)[]
	? IsNormalRelation<U>
	: [Extract<T, ID>] extends [never]
	? false
	: [Exclude<T, ID | null | undefined>] extends [never]
	? false
	: Exclude<T, ID | null | undefined> extends { id: ID }
	? true
	: false;

type IsPolymorphicRelation<T> =
	NonNullable<T> extends (infer K)[]
	? IsPolymorphicRelation<K>
	: NonNullable<T> extends { relationTo: string; value: infer U }
	? IsNormalRelation<U>
	: false;

type IsDocRelation<T> =
	NonNullable<T> extends { docs?: (infer U)[] }
	? IsNormalRelation<U> extends true
	? true
	: IsPolymorphicRelation<U> extends true
	? true
	: false
	: false;

type StripNormalObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
	? Extract<U, ID | null | undefined>[]
	: Extract<T, ID | null | undefined>
>;

type StripNormalID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[] ? StripNormalID<U>[] : Exclude<T, ID>
>;

type StripPolymorphicID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
	? StripPolymorphicID<U>[]
	: NonNullable<T> extends PolymorphicObject
	? { [K in keyof T]: K extends "value" ? Exclude<T[K], ID> : T[K] }
	: StripNormalID<T>
>;

type StripPolymorphicObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
	? StripPolymorphicObject<U>[]
	: NonNullable<T> extends PolymorphicObject
	? {
		[K in keyof T]: K extends "value"
		? Extract<T[K], ID | null | undefined>
		: T[K];
	}
	: StripNormalObject<T>
>;

type StripDocID<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
	? StripDocID<U>[]
	: NonNullable<T> extends Doc
	? { [K in keyof T]: K extends "docs" ? StripPolymorphicID<T[K]> : T[K] }
	: StripPolymorphicID<T>
>;

type StripDocObject<T> = FollowNullable<
	IsNullable<T>,
	NonNullable<T> extends (infer U)[]
	? StripDocObject<U>[]
	: NonNullable<T> extends Doc
	? {
		[K in keyof T]: K extends "docs"
		? StripPolymorphicObject<T[K]>
		: T[K];
	}
	: StripPolymorphicObject<T>
>;

type StripID<T> =
	IsDocRelation<T> extends true
	? StripDocID<T>
	: IsPolymorphicRelation<T> extends true
	? StripPolymorphicID<T>
	: IsNormalRelation<T> extends true
	? StripNormalID<T>
	: T;

type StripObject<T> =
	IsDocRelation<T> extends true
	? StripDocObject<T>
	: IsPolymorphicRelation<T> extends true
	? StripPolymorphicObject<T>
	: IsNormalRelation<T> extends true
	? StripNormalObject<T>
	: T;

type DepthZeroArrayItem<U> = U extends object
	? {
		[K in keyof U]: FollowNullable<
			IsNullable<U[K]>,
			NonNullable<StripObject<U[K]>>
		>;
	}
	: U;

type DepthZeroObject<T> = {
	[K in keyof T]: NonNullable<T[K]> extends object
	? NonNullable<T[K]> extends (infer U extends object)[]
	? DepthZeroArrayItem<U>[]
	: NonNullable<StripObject<T[K]>>
	: NonNullable<StripObject<T[K]>>;
};

type DepthZero<T> = T extends (infer U)[]
	? DepthZeroArrayItem<U>[]
	: T extends object
	? DepthZeroObject<T>
	: StripObject<T>;

type DepthNormalRelation<T, D extends number> = Depth<
	NonNullable<StripID<T>>,
	Subtract<D, 1>
>;

type DepthPolymorphicRelation<T, D extends number> =
	NonNullable<T> extends (infer U extends object)[]
	? Depth<NonNullable<StripID<U>>, Subtract<D, 1>>[]
	: {
		[K in keyof T]: K extends "value"
		? Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
		: T[K];
	};

type DepthDocRelation<T, D extends number> = {
	[K in keyof T]: K extends "docs"
	? Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
	: T[K];
};

type DepthArrayItem<U, D extends number> = U extends object
	? {
		[K in keyof U]: FollowNullable<
			IsNullable<U[K]>,
			Depth<NonNullable<StripID<U[K]>>, Subtract<D, 1>>
		>;
	}
	: U;

type DepthObject<T, D extends number> = {
	[K in keyof T]: FollowNullable<
		IsNullable<T[K]>,
		Depth<NonNullable<StripID<T[K]>>, Subtract<D, 1>>
	>;
};

type DepthFallback<T, D extends number> = T extends (infer U extends object)[]
	? DepthArrayItem<U, D>[]
	: T extends object
	? DepthObject<T, D>
	: T;

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
	| "findGlobal" = "findByID"
>() {
	return <T>(data: T) => data as T & Depth<T, D>;
}
