import { $ } from "bun"

import { readdir } from "node:fs/promises"


await $`react-router build`;

// read all files in build
const buildFiles = await readdir("./build/client", { withFileTypes: true, recursive: true }).then(files => files.filter(f => f.isFile()).map(f => `./${f.parentPath}/${f.name}`));

// generate vfs.ts
async function generateVfs() {
  const relativeFiles = buildFiles.map(f => f.replace('./build/', ''));
  const fileContents = await Promise.all(
    buildFiles.map(async (filePath) => {
      const buffer = await Bun.file(filePath).bytes();
      return Buffer.from(buffer).toString('base64');
    })
  );

  return `export default {
  ${relativeFiles.map((f, i) => {
    // Strip 'client/' prefix for serving static assets
    const servePath = f.startsWith('client/') ? f.replace('client/', '') : f;
    return `"${servePath}": "${fileContents[i]}"`;
  }).join(",\n")}
};
`;
}

// write the generated vfs to server/vfs.ts
await Bun.write("server/vfs.ts", await generateVfs());

console.log(`✨ generated server/vfs.ts`)



await Bun.build({
  entrypoints: ["./server/index.ts"].flat(),
  outdir: "./dist",
  minify: true,
  sourcemap: true,
  "define": {
    // for txt based files, we read them as utf-8 strings and put them in the env
    "process.env.ENV": '"production"',
  },
  "naming": {
    "asset": "[dir]/[name].[ext]",
  },
  compile: {
    target: "bun-darwin-arm64",
    outfile: "paideia",
    "execArgv": ["--asset-naming=\"[name].[ext]\""],
  }
});


await $`rm -rf ./build`