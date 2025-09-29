import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";
import ignore from "ignore";

const ignoreFile = await readFile(".gitignore", "utf-8");

const ignoreList = ignore().add(ignoreFile);

/**
 * only the test files with .test.ts extension.
 *
 * ! .spec.ts is not a bun test file but playwright test file.
 */
const testFiles = await readdir(".", {
	withFileTypes: true,
	recursive: true,
}).then((files) =>
	files
		.filter((f) => f.isFile() && f.name.endsWith(".test.ts"))
		.map(
			// relative path
			(f) => path.relative(process.cwd(), `./${f.parentPath}/${f.name}`),
		)
		.filter((f) => !ignoreList.ignores(f)),
);

// sequentially test all the test files
for (const testFile of testFiles) {
	await $`bun test ${testFile}`;
}
