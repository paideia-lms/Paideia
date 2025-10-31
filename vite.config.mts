import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
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
		// babel({
		// 	filter: /\.[jt]sx?$/,
		// 	babelConfig: {
		// 		presets: ["@babel/preset-typescript"], // if you use TypeScript
		// 		plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
		// 	},
		// }),
		envOnlyMacros(),
		tsconfigPaths(),
		devtoolsJson(),
	],
	optimizeDeps: {
		exclude: ["file-type"],
		include: ["@excalidraw/excalidraw"],
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
