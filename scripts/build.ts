import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import os from "node:os";
import { $ } from "bun";


// Log OS information
const platform = os.platform();
const arch = os.arch();
console.log("🖥️  OS Information:");
console.log(`   Platform: ${platform}`);
console.log(`   Architecture: ${arch}`);
console.log(`   Hostname: ${os.hostname()}`);
console.log(`   Type: ${os.type()}`);
console.log(`   Release: ${os.release()}`);
console.log(`   Version: ${os.version()}`);
console.log(`   CPU Model: ${os.cpus()[0]?.model || "Unknown"}`);
console.log(`   Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`   Free Memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`   Uptime: ${(os.uptime() / 3600).toFixed(2)} hours`);
console.log("");

// Determine build target based on platform and architecture
function getBuildTarget(): { target: string; outfile: string } {
	const platformLower = platform.toLowerCase();
	const archLower = arch.toLowerCase();

	if (platformLower === "darwin") {
		if (archLower === "arm64") {
			return { target: "bun-darwin-arm64", outfile: "paideia" };
		} else if (archLower === "x64") {
			return { target: "bun-darwin-x64", outfile: "paideia" };
		}
	} else if (platformLower === "linux") {
		if (archLower === "arm64") {
			return { target: "bun-linux-arm64", outfile: "paideia-linux-arm64" };
		} else if (archLower === "x64") {
			// Default to modern for x64, but could use baseline for compatibility
			return { target: "bun-linux-x64", outfile: "paideia-linux-x64" };
		}
	} else if (platformLower === "win32") {
		if (archLower === "x64") {
			// Default to modern for x64, but could use baseline for compatibility
			return { target: "bun-windows-x64", outfile: "paideia.exe" };
		}
	}

	throw new Error(`Unsupported platform/architecture combination: ${platform} ${arch}`);
}

// Check if we should build for all platforms (e.g., in CI)
const buildAllPlatforms = process.env.BUILD_ALL_PLATFORMS === "true";

let buildTargets: Array<{ target: string; outfile: string }>;

if (buildAllPlatforms) {
	// Build for both macOS and Linux ARM64 (for CI/releases)
	buildTargets = [
		{ target: "bun-darwin-arm64", outfile: "paideia" },
		{ target: "bun-linux-arm64", outfile: "paideia-linux-arm64" },
		{ target: "bun-linux-x64", outfile: "paideia-linux-x64" },
		{ target: "bun-windows-x64", outfile: "paideia.exe" },
	];
	console.log(`🔨 Building for all platforms (CI mode)`);
	buildTargets.forEach((config) => {
		console.log(`   - ${config.target} -> ${config.outfile}`);
	});
} else {
	// Build only for current platform
	const buildConfig = getBuildTarget();
	buildTargets = [buildConfig];
	console.log(`🔨 Building for ${buildConfig.target}`);
	console.log(`   Output file: ${buildConfig.outfile}`);
}
console.log("");

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

// Check for native dependencies before cleaning up build directory
console.log(`🔍 Checking for native dependencies in build/server/index.js...`);
const checkResult = await $`./scripts/check-native-deps.sh build/server/index.js node_modules`.nothrow();

if (checkResult.exitCode !== 0) {
	console.error(`❌ Build aborted: Native dependencies detected in bundled code!`);
	console.error(`   The build directory has been preserved for inspection.`);
	console.error(`   Please review the native dependencies and update your code to avoid bundling them.`);
	process.exit(1);
}

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

// Build binaries for all target platforms
const entrypoint = resolve(process.cwd(), "./server/index.ts");

for (const buildConfig of buildTargets) {
	console.log(`🔨 Building ${buildConfig.outfile} for ${buildConfig.target}...`);
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
			target: buildConfig.target as Bun.Build.Target,
			outfile: buildConfig.outfile,
			execArgv: ['--asset-naming="[name].[ext]"'],
		},
	});
	console.log(`✅ Built ${buildConfig.outfile} for ${buildConfig.target}`);
}




console.log(`✅ No native dependencies detected in bundled code.`);
// replace server/vfs.ts back to empty object
await Bun.write("server/vfs.ts", "export default {} as const;");
await $`rm -rf ./build`;
