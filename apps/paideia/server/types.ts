import type { ServerBuild } from "react-router";

export type GetLoadContext<T> = (
	request: Request,
	serverBuild: ServerBuild,
) => T | Promise<T>;
