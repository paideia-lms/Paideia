import * as cheerio from "cheerio";
import { serverOnly$ } from "vite-env-only/macros";

/**
 * Extract plain text content from HTML string
 * Uses Cheerio for server-side only
 * This function is automatically removed from client bundle
 */
export const getTextContentFromHtmlServer = serverOnly$(
	(html: string): string => {
		const $ = cheerio.load(html);
		const text = $("body").text().trim().replace(/\s+/g, " ");
		return text;
	},
)!;

// get text content of the first paragraph of the html
export const getTextContentFromHtmlServerFirstParagraph = serverOnly$(
	(html: string): string => {
		const $ = cheerio.load(html);
		const text = $("body p").first().text().trim().replace(/\s+/g, " ");
		return text;
	},
)!;
