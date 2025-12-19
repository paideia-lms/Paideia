export function assertRequestMethod<
	T extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE",
>(method: string, target: T): asserts method is Lowercase<T> | T {
	if (method.toUpperCase() !== target) {
		throw new Error("Method not allowed");
	}
}

export function assertRequestMethodInRemix<
	T extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE",
>(method: string, target: T): asserts method is Lowercase<T> | T {
	if (method.toUpperCase() !== target) {
		throw new Response("Method not allowed", { status: 405 });
	}
}

export function isRequestMethod<T extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE">(method: string, target: T): method is Lowercase<T> | T {
	return method.toUpperCase() === target;
}