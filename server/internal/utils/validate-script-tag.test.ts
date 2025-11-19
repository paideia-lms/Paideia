import { describe, expect, test } from "bun:test";
import { tryValidateScriptTag } from "./validate-script-tag";

describe("Validate Script Tag", () => {
	test("should validate valid script tag with src only", () => {
		const scriptHtml = `<script src="https://example.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value.defer).toBeUndefined();
			expect(result.value.async).toBeUndefined();
		}
	});

	test("should validate script tag with defer attribute", () => {
		const scriptHtml = `<script defer src="https://example.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value.defer).toBe(true);
		}
	});

	test("should validate script tag with async attribute", () => {
		const scriptHtml = `<script async src="https://example.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value.async).toBe(true);
		}
	});

	test("should validate script tag with both defer and async", () => {
		const scriptHtml = `<script defer async src="https://example.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value.defer).toBe(true);
			expect(result.value.async).toBe(true);
		}
	});

	test("should validate Umami script tag with data-website-id", () => {
		const scriptHtml = `<script defer src="https://cloud.umami.is/script.js" data-website-id="63b7582a-1ce5-46fd-8635-612cbba6cd1c"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://cloud.umami.is/script.js");
			expect(result.value.defer).toBe(true);
			expect(result.value["data-website-id"]).toBe(
				"63b7582a-1ce5-46fd-8635-612cbba6cd1c",
			);
		}
	});

	test("should validate Plausible script tag with data-domain", () => {
		const scriptHtml = `<script defer data-domain="example.com" src="https://plausible.io/js/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://plausible.io/js/script.js");
			expect(result.value.defer).toBe(true);
			expect(result.value["data-domain"]).toBe("example.com");
		}
	});

	test("should validate Fathom script tag with data-site", () => {
		const scriptHtml = `<script defer data-site="ABCDEFGH" src="https://cdn.usefathom.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://cdn.usefathom.com/script.js");
			expect(result.value.defer).toBe(true);
			expect(result.value["data-site"]).toBe("ABCDEFGH");
		}
	});

	test("should validate Google Analytics script tag", () => {
		const scriptHtml = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe(
				"https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX",
			);
			expect(result.value.async).toBe(true);
		}
	});

	test("should validate script tag with multiple data attributes", () => {
		const scriptHtml = `<script src="https://example.com/script.js" data-website-id="123" data-domain="example.com" data-site="ABC"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value["data-website-id"]).toBe("123");
			expect(result.value["data-domain"]).toBe("example.com");
			expect(result.value["data-site"]).toBe("ABC");
		}
	});

	test("should reject script tag without src attribute", () => {
		const scriptHtml = `<script>console.log('test');</script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("src attribute");
		}
	});

	test("should reject inline script content", () => {
		const scriptHtml = `<script src="https://example.com/script.js">console.log('test');</script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain(
				"Inline script content is not allowed",
			);
		}
	});

	test("should reject script tag with onerror attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" onerror="alert('xss')"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dangerous attribute");
			expect(result.error.message).toContain("onerror");
		}
	});

	test("should reject script tag with onload attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" onload="alert('xss')"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dangerous attribute");
			expect(result.error.message).toContain("onload");
		}
	});

	test("should reject script tag with onclick attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" onclick="alert('xss')"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dangerous attribute");
			expect(result.error.message).toContain("onclick");
		}
	});

	test("should reject script tag with integrity attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" integrity="sha384-..."></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dangerous attribute");
			expect(result.error.message).toContain("integrity");
		}
	});

	test("should reject script tag with crossorigin attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" crossorigin="anonymous"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dangerous attribute");
			expect(result.error.message).toContain("crossorigin");
		}
	});

	test("should reject script tag with non-HTTP/HTTPS URL", () => {
		const scriptHtml = `<script src="javascript:alert('xss')"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("protocol");
		}
	});

	test("should reject script tag with file:// URL", () => {
		const scriptHtml = `<script src="file:///path/to/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("protocol");
		}
	});

	test("should reject invalid URL format", () => {
		const scriptHtml = `<script src="not-a-url"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Invalid URL format");
		}
	});

	test("should reject script tag with unknown attribute", () => {
		const scriptHtml = `<script src="https://example.com/script.js" type="text/javascript"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Unknown attribute");
		}
	});

	test("should reject empty script tag", () => {
		const scriptHtml = ``;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("empty");
		}
	});

	test("should reject whitespace-only script tag", () => {
		const scriptHtml = `   `;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("empty");
		}
	});

	test("should reject multiple script tags", () => {
		const scriptHtml = `<script src="https://example.com/script1.js"></script><script src="https://example.com/script2.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Multiple script tags");
		}
	});

	test("should reject script tag with no script element", () => {
		const scriptHtml = `<div>Not a script</div>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("No script tag found");
		}
	});

	test("should handle HTTP URL (not just HTTPS)", () => {
		const scriptHtml = `<script src="http://example.com/script.js"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("http://example.com/script.js");
		}
	});

	test("should handle script tag with URL containing query parameters", () => {
		const scriptHtml = `<script src="https://example.com/script.js?v=1.0&id=123"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe(
				"https://example.com/script.js?v=1.0&id=123",
			);
		}
	});

	test("should handle script tag with URL containing hash fragment", () => {
		const scriptHtml = `<script src="https://example.com/script.js#section"></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js#section");
		}
	});

	test("should handle empty data attribute value", () => {
		const scriptHtml = `<script src="https://example.com/script.js" data-website-id=""></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value["data-website-id"]).toBe("");
		}
	});

	test("should handle script tag with whitespace around attributes", () => {
		const scriptHtml = `<script   src="https://example.com/script.js"   defer   ></script>`;

		const result = tryValidateScriptTag(scriptHtml);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.src).toBe("https://example.com/script.js");
			expect(result.value.defer).toBe(true);
		}
	});
});
