import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import type { Storage } from "unstorage";

/**
 * Renders D2 code to SVG using the D2 CLI
 *
 * @param code - D2 diagram code to render
 * @param unstorage - Storage instance for caching
 * @returns Promise resolving to the SVG string
 * @throws Error if D2 CLI is not available or rendering fails
 */
export async function renderD2ToSvg(
	code: string,
	unstorage: Storage,
): Promise<string> {
	// Generate unique file names
	// hash the code into a string
	const uniqueId = createHash("sha256").update(code).digest("hex");
	const tempDir = tmpdir();
	const inputPath = join(tempDir, `d2-${uniqueId}.d2`);
	const outputPath = join(tempDir, `d2-${uniqueId}.svg`);

	// Check if the SVG is already in the cache
	const cachedSvg = await unstorage.getItem(`d2-${uniqueId}.svg`);
	if (cachedSvg) {
		console.log("Cached SVG found for", uniqueId);
		return cachedSvg as string;
	}

	// Ensure temp directory exists
	if (!existsSync(tempDir)) {
		mkdirSync(tempDir, { recursive: true });
	}

	try {
		// Write D2 code to temporary file
		writeFileSync(inputPath, code, "utf-8");

		// Execute D2 CLI to convert D2 to SVG
		// Use --theme=0 for default theme and --sketch=false for clean output
		const { stderr } =
			await $`d2 --theme=0 --sketch=false "${inputPath}" "${outputPath}"`;

		if (stderr && !existsSync(outputPath)) {
			console.error("D2 compilation error:", stderr);
			throw new Error(`D2 compilation failed: ${stderr}`);
		}

		// Read the generated SVG
		const svg = readFileSync(outputPath, "utf-8");

		// Store the SVG in the cache
		await unstorage.setItem(`d2-${uniqueId}.svg`, svg);

		return svg;
	} finally {
		// Clean up temporary files
		try {
			if (existsSync(inputPath)) {
				unlinkSync(inputPath);
			}
			if (existsSync(outputPath)) {
				unlinkSync(outputPath);
			}
		} catch (cleanupError) {
			console.error("Error cleaning up temporary files:", cleanupError);
		}
	}
}
