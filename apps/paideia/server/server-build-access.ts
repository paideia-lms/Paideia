import type { ServerBuild } from "react-router";
import type { ViteDevServer } from "vite";

let viteInstance: ViteDevServer | undefined;

export function setVite(vite: ViteDevServer | undefined): void {
	viteInstance = vite;
}

export async function getServerBuild(): Promise<ServerBuild> {
	if (viteInstance) {
		return (await viteInstance.ssrLoadModule(
			"virtual:react-router/server-build",
		)) as ServerBuild;
	}
	// @ts-expect-error - build output appears when we run build
	return (await import("../build/server/index.js")) as ServerBuild;
}
