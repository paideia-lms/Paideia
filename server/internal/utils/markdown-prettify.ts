import { remark } from "remark";
import remarkGfm from "remark-gfm";

/**
 * Prettifies markdown by processing it through remark with GFM support
 * This will normalize formatting, fix spacing, and ensure consistent structure
 * 
 * @param markdown - Raw markdown string to prettify
 * @returns Prettified markdown string with normalized formatting
 */
export function prettifyMarkdown(markdown: string): string {
	try {
		const result = remark()
			.use(remarkGfm)
			.processSync(markdown);

		return String(result);
	} catch (error) {
		// If processing fails, return original markdown
		// This ensures we don't break the output if there's a parsing issue
		console.error("Failed to prettify markdown:", error);
		return markdown;
	}
}

