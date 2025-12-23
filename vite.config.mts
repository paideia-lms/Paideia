import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { envOnlyMacros } from "vite-env-only";
// import babel from "vite-plugin-babel";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";
import { denyImports } from "vite-env-only"


// see https://react.dev/learn/react-compiler/installation#usage-with-react-router
// const ReactCompilerConfig = {
// 	/* ... */
// };

export default defineConfig({
	plugins: [
		reactRouter(),
		envOnlyMacros(),
		tsconfigPaths(),
		devtoolsJson(),
		denyImports({
			client: {
			  specifiers: ["payload"],
			  files: ["server/contexts/user-context.ts"],
			},
			server: {
			//   specifiers: ["jquery"],
			},
		  }),
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
