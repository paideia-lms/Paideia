import type { RouterContext, RouterContextProvider } from "react-router";
import { Result } from "typescript-result";
import { ContextNotFoundError } from "./error";

export function tryGetContext<T>(
	context: Readonly<RouterContextProvider>,
	target: RouterContext<T>,
) {
	return Result.try(
		() => context.get(target),
		(error) => new ContextNotFoundError("Context not found", { cause: error }),
	).getOrNull();
}
