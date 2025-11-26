import * as cheerio from "cheerio";
import { Result } from "typescript-result";
import {
	ScriptValidationError,
	transformError,
	UnknownError,
} from "~/utils/error";

export interface ScriptTagAttributes {
	src: string;
	defer?: boolean;
	async?: boolean;
	[key: `data-${string}`]: string;
}

/**
 * Validates and sanitizes a script tag HTML string to prevent malicious code injection.
 * Only allows external scripts with safe attributes.
 *
 * Allowed attributes:
 * - src (required, must be HTTP/HTTPS URL)
 * - defer (boolean)
 * - async (boolean)
 * - data-* (any data attribute)
 *
 * Rejected:
 * - Inline script content
 * - Dangerous attributes (onerror, onload, onclick, etc.)
 * - Non-HTTP/HTTPS URLs
 * - Scripts without src attribute
 */
export const tryValidateScriptTag = Result.wrap(
	(scriptHtml: string): ScriptTagAttributes => {
		if (!scriptHtml || scriptHtml.trim().length === 0) {
			throw new ScriptValidationError("Script tag cannot be empty");
		}

		// Parse HTML with cheerio
		const $ = cheerio.load(scriptHtml, { xml: { decodeEntities: false } });
		const scripts = $("script");

		if (scripts.length === 0) {
			throw new ScriptValidationError("No script tag found");
		}

		if (scripts.length > 1) {
			throw new ScriptValidationError(
				"Multiple script tags found. Only one script tag is allowed.",
			);
		}

		const script = scripts[0];
		if (!script) {
			throw new ScriptValidationError("No script tag found");
		}
		const $script = $(script);

		// Check for inline script content (reject if present)
		const scriptContent = $script.html();
		if (scriptContent && scriptContent.trim().length > 0) {
			throw new ScriptValidationError(
				"Inline script content is not allowed. Only external scripts with src attribute are permitted.",
			);
		}

		// Get src attribute (required)
		const src = $script.attr("src");
		if (!src) {
			throw new ScriptValidationError("Script tag must have a src attribute");
		}

		// Validate src is HTTP/HTTPS URL
		try {
			const url = new URL(src);
			if (url.protocol !== "http:" && url.protocol !== "https:") {
				throw new ScriptValidationError(
					`Invalid URL protocol: ${url.protocol}. Only HTTP and HTTPS are allowed.`,
				);
			}
		} catch (error) {
			if (
				error instanceof ScriptValidationError &&
				error.message.includes("Invalid URL protocol")
			) {
				throw error;
			}
			throw new ScriptValidationError(`Invalid URL format: ${src}`);
		}

		// Get all attributes
		const attributes: ScriptTagAttributes = {
			src,
		};

		// List of dangerous attributes that should be rejected
		const dangerousAttributes = [
			"onerror",
			"onload",
			"onclick",
			"onmouseover",
			"onmouseout",
			"onfocus",
			"onblur",
			"onchange",
			"onsubmit",
			"onreset",
			"onselect",
			"onunload",
			"integrity", // We don't allow integrity to prevent CSP bypass attempts
			"crossorigin", // We don't allow crossorigin to prevent CORS issues
		];

		// Check each attribute
		const allowedAttributes = new Set(["src", "defer", "async"]);

		// Get all attributes from the script tag
		if (script.attribs) {
			for (const [attrName, attrValue] of Object.entries(script.attribs)) {
				const lowerAttrName = attrName.toLowerCase();

				// Reject dangerous attributes
				if (dangerousAttributes.includes(lowerAttrName)) {
					throw new ScriptValidationError(
						`Dangerous attribute "${attrName}" is not allowed for security reasons.`,
					);
				}

				// Handle allowed attributes
				if (lowerAttrName === "defer") {
					attributes.defer = true;
				} else if (lowerAttrName === "async") {
					attributes.async = true;
				} else if (lowerAttrName.startsWith("data-")) {
					// Allow any data-* attribute
					attributes[lowerAttrName as `data-${string}`] = attrValue || "";
				} else if (!allowedAttributes.has(lowerAttrName)) {
					// Reject unknown attributes (except data-*)
					throw new ScriptValidationError(
						`Unknown attribute "${attrName}" is not allowed. Only src, defer, async, and data-* attributes are permitted.`,
					);
				}
			}
		}

		return attributes;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to validate script tag", { cause: error }),
);
