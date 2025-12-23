export function isRequestMethod<
	T extends "POST" | "GET" | "PATCH" | "PUT" | "DELETE",
>(method: string, target: T): method is Lowercase<T> | T {
	return method.toUpperCase() === target;
}
