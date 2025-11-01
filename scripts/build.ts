import { readdir } from "node:fs/promises";
import { $ } from "bun";

await $`react-router build`;

// read all files in build
const buildFiles = await readdir("./build/client", {
	withFileTypes: true,
	recursive: true,
}).then((files) =>
	files.filter((f) => f.isFile()).map((f) => `./${f.parentPath}/${f.name}`),
);

// read all fixture files
const fixtureFiles = await readdir("./fixture", {
	withFileTypes: true,
	recursive: true,
}).then((files) =>
	files
		.filter((f) => f.isFile())
		.map((f) => {
			// parentPath is already "./fixture", so just construct the path
			// Remove leading "./" to get "fixture/filename.ext"
			const fullPath = `${f.parentPath}/${f.name}`;
			return fullPath.replace(/^\.\//, "");
		}),
);

console.log(buildFiles);

// generate vfs.ts
async function generateVfs() {
	const relativeFiles = buildFiles.map((f) => f.replace("./build/", ""));
	const fileContents = await Promise.all(
		buildFiles.map(async (filePath) => {
			const buffer = await Bun.file(filePath).bytes();
			return Buffer.from(buffer).toString("base64");
		}),
	);

	// Process fixture files - paths are already in format "fixture/filename.ext"
	const fixtureRelativeFiles = fixtureFiles;
	const fixtureFileContents = await Promise.all(
		fixtureFiles.map(async (filePath) => {
			// filePath is "fixture/filename.ext", use as-is for Bun.file (it expects "./fixture/...")
			const buffer = await Bun.file(`./${filePath}`).bytes();
			return Buffer.from(buffer).toString("base64");
		}),
	);

	// Combine build files and fixture files
	const allFiles = [...relativeFiles, ...fixtureRelativeFiles];
	const allContents = [...fileContents, ...fixtureFileContents];

	return `export default {
  ${allFiles
			.map((f, i) => {
				// Strip 'client/' prefix for serving static assets
				const servePath = f.startsWith("client/") ? f.replace("client/", "") : f;
				return `"${servePath}": "${allContents[i]}"`;
			})
			.join(",\n")}
};
`;
}

// write the generated vfs to server/vfs.ts
await Bun.write("server/vfs.ts", await generateVfs());

console.log(`✨ generated server/vfs.ts`);

await Bun.build({
	entrypoints: ["./server/index.ts"].flat(),
	outdir: "./dist",
	// minify: true,
	sourcemap: true,
	define: {
		// ! we need this value for tree shaking
		"process.env.ENV": '"production"',
		"process.env.NODE_ENV": '"production"',
	},
	naming: {
		asset: "[dir]/[name].[ext]",
	},
	compile: {
		target: "bun-darwin-arm64",
		outfile: "paideia",
		execArgv: ['--asset-naming="[name].[ext]"'],
	},
});

// await Bun.build({
// 	entrypoints: ["./server/index.ts"].flat(),
// 	outdir: "./dist",
// 	// minify: true,
// 	sourcemap: true,
// 	define: {
// 		// ! we need this value for tree shaking
// 		"process.env.ENV": '"production"',
// 		"process.env.NODE_ENV": '"production"',
// 	},
// 	naming: {
// 		asset: "[dir]/[name].[ext]",
// 	},
// 	compile: {
// 		target: "bun-linux-arm64",
// 		outfile: "paideia-linux-arm64",
// 		execArgv: ['--asset-naming="[name].[ext]"'],
// 	},
// });

await $`rm -rf ./build`;
