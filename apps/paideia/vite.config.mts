import { unstable_reactRouterRSC as reactRouterRSC, reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import rsc from "@vitejs/plugin-rsc";

import { envOnlyMacros } from "vite-env-only";
// import babel from "vite-plugin-babel";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";

// see https://react.dev/learn/react-compiler/installation#usage-with-react-router
// const ReactCompilerConfig = {
// 	/* ... */
// };

export default defineConfig({
	plugins: [
		reactRouter(),
		// rsc(),
		envOnlyMacros(),
		tsconfigPaths(),
		devtoolsJson(),
	],
	optimizeDeps: {
		exclude: ["file-type"],
		include: ["@excalidraw/excalidraw"],
	},
	server: {
		allowedHosts: [".localcan.dev"],
	},
	ssr: {
		external: ["@excalidraw/excalidraw", "bun"],
	},
	build: {
		rollupOptions: {
			external: ["bun"],
		},
	},
});
