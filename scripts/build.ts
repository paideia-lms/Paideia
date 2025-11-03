import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";

await $`bun react-router build`;

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

// Build macOS binary
const entrypoint = resolve(process.cwd(), "./server/index.ts");
await Bun.build({
	entrypoints: [entrypoint],
	outdir: "./dist",
	root: process.cwd(), // Explicitly set root to current working directory
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

// Build Linux ARM64 binary
await Bun.build({
	entrypoints: [entrypoint],
	outdir: "./dist",
	root: process.cwd(), // Explicitly set root to current working directory
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
		target: "bun-linux-arm64",
		outfile: "paideia-linux-arm64",
		execArgv: ['--asset-naming="[name].[ext]"'],
	},
});


// Check for native dependencies before cleaning up build directory
console.log(`🔍 Checking for native dependencies in build/server/index.js...`);
const checkResult = await $`./scripts/check-native-deps.sh build/server/index.js node_modules`.nothrow();

if (checkResult.exitCode !== 0) {
	console.error(`❌ Build aborted: Native dependencies detected in bundled code!`);
	console.error(`   The build directory has been preserved for inspection.`);
	console.error(`   Please review the native dependencies and update your code to avoid bundling them.`);
	process.exit(1);
}

console.log(`✅ No native dependencies detected in bundled code.`);
// replace server/vfs.ts back to empty object
await Bun.write("server/vfs.ts", "export default {} as const;");
await $`rm -rf ./build`;
