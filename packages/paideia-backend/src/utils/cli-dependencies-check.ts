import { $ } from "bun";

/**
 * Check if D2 CLI command is available
 */
export async function isD2Available(): Promise<boolean> {
	const { stdout, stderr } = await $`d2 --version`;
	if (stderr.toString().trim() !== "") {
		console.error("Failed to check if d2 is available:", stderr.toString());
		return false;
	} else {
		const version = stdout.toString().trim();
		console.log("d2 version:", version);
		return true;
	}
}
