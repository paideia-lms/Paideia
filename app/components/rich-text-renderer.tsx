import { Typography, type TypographyProps } from "@mantine/core";
import * as cheerio from "cheerio";
import { decode } from "entities";
import { toHtml } from "hast-util-to-html";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import js from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import ts from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { mermaidGrammar } from "lowlight-mermaid";
import mermaid from "mermaid";
import { useEffect, useMemo, useState } from "react";
import { renderD2 } from "~/routes/api/d2-render";

const lowlight = createLowlight();

// Helper functions for diagram rendering
function createErrorHtml(type: string, message: string): string {
	return `
		<div style="color: var(--mantine-color-red-6); padding: 1rem; border: 1px solid var(--mantine-color-red-6); border-radius: 4px;">
			<strong>${type} Rendering Error:</strong><br/>
			${message}
		</div>
	`;
}

function replaceHtmlPlaceholder(
	html: string,
	selector: string,
	content: string,
): string {
	const $ = cheerio.load(html);
	const placeholder = $(selector);
	placeholder.html(content);
	return $("body")?.html() ?? $.html();
}

async function renderMermaidDiagram(
	block: { id: string; code: string },
	html: string,
): Promise<string> {
	try {
		const { svg } = await mermaid.render(block.id, block.code);
		return replaceHtmlPlaceholder(html, `[data-mermaid-id="${block.id}"]`, svg);
	} catch (error) {
		console.error(`Failed to render mermaid diagram ${block.id}:`, error);
		const errorHtml = createErrorHtml(
			"Mermaid",
			error instanceof Error ? error.message : "Unknown error",
		);
		return replaceHtmlPlaceholder(
			html,
			`[data-mermaid-id="${block.id}"]`,
			errorHtml,
		);
	}
}

async function renderD2Diagram(
	block: { id: string; code: string },
	html: string,
): Promise<string> {
	try {
		const data = await renderD2(block.code);

		if ("svg" in data && data.svg) {
			return replaceHtmlPlaceholder(
				html,
				`[data-d2-id="${block.id}"]`,
				data.svg,
			);
		}
		if ("error" in data && data.error) {
			throw new Error(
				typeof data.error === "string"
					? data.error
					: JSON.stringify(data.error),
			);
		}
		throw new Error("No SVG or error returned from D2 renderer");
	} catch (error) {
		console.error(`Failed to render D2 diagram ${block.id}:`, error);
		const errorHtml = createErrorHtml(
			"D2",
			error instanceof Error ? error.message : "Unknown error",
		);
		return replaceHtmlPlaceholder(
			html,
			`[data-d2-id="${block.id}"]`,
			errorHtml,
		);
	}
}

// Register common programming languages
lowlight.register("typescript", ts);
lowlight.register("javascript", js);
lowlight.register("python", python);
lowlight.register("java", java);
lowlight.register("css", css);
lowlight.register("html", html);
lowlight.register("json", json);
lowlight.register("bash", bash);
lowlight.register("sql", sql);
lowlight.register("yaml", yaml);
lowlight.register("markdown", markdown);
lowlight.register("mermaid", mermaidGrammar);

interface RichTextRendererProps
	extends Omit<TypographyProps, "dangerouslySetInnerHTML"> {
	/**
	 * HTML content to render (should be sanitized)
	 */
	content: string;
	/**
	 * Additional CSS class names
	 */
	className?: string;
}

/**
 * Component for rendering rich text HTML content created by TipTap editor.
 * Applies the 'tiptap' class to ensure proper styling from app.css.
 * Automatically highlights code blocks using lowlight.
 * Renders mermaid diagrams.
 *
 * @example
 * ```tsx
 * <RichTextRenderer content={note.content} />
 * ```
 */
export function RichTextRenderer({
	content,
	className,
	...boxProps
}: RichTextRendererProps) {
	const [renderedContent, setRenderedContent] = useState<string>("");

	// Process content and extract mermaid and d2 diagrams
	const { html, mermaidBlocks, d2Blocks } = useMemo(() => {
		const decoded = decode(content);
		const $ = cheerio.load(decoded);
		const mermaidBlocks: Array<{ id: string; code: string }> = [];
		const d2Blocks: Array<{ id: string; code: string }> = [];

		// FIRST: Process mermaid code blocks BEFORE lowlight highlights them
		// This ensures we get the unaltered mermaid code
		$("pre code.language-mermaid").each((index, element) => {
			const $code = $(element);
			const $pre = $code.parent("pre");

			// Extract the raw mermaid code (before any highlighting)
			const mermaidCode = $code.text();
			const id = `mermaid-${Date.now()}-${index}`;

			// Store mermaid block for async rendering
			mermaidBlocks.push({ id, code: mermaidCode });

			// Create a placeholder div with unique ID
			const placeholder = `<div class="mermaid-wrapper" data-mermaid-id="${id}"><div class="mermaid-placeholder">Loading diagram...</div></div>`;

			// Replace the pre tag with placeholder
			$pre.replaceWith(placeholder);
		});

		// Process D2 code blocks BEFORE lowlight highlights them
		$("pre code.language-d2").each((index, element) => {
			const $code = $(element);
			const $pre = $code.parent("pre");

			// Extract the raw D2 code (before any highlighting)
			const d2Code = $code.text();
			const id = `d2-${Date.now()}-${index}`;

			// Store d2 block for async rendering
			d2Blocks.push({ id, code: d2Code });

			// Create a placeholder div with unique ID
			const placeholder = `<div class="d2-wrapper" data-d2-id="${id}"><div class="d2-placeholder">Loading diagram...</div></div>`;

			// Replace the pre tag with placeholder
			$pre.replaceWith(placeholder);
		});

		// SECOND: Process all other code blocks with lowlight
		$("pre code[class*='language-']").each((_, element) => {
			const $code = $(element);

			// Extract language from class name (e.g., "language-python" -> "python")
			const classList = $code.attr("class")?.split(" ") || [];
			const languageClass = classList.find((cls) =>
				cls.startsWith("language-"),
			);

			if (!languageClass) return;

			const language = languageClass.replace("language-", "").trim();
			const code = $code.text();

			try {
				// Check if language is registered
				if (lowlight.registered(language)) {
					// Highlight the code
					const tree = lowlight.highlight(language, code);
					// Convert to HTML
					const highlightedHtml = toHtml(tree);
					// Update the element with highlighted HTML
					$code.html(highlightedHtml);
				}
			} catch (error) {
				console.warn(
					`Failed to highlight code block with language: ${language}`,
					error,
				);
			}
		});

		// Get the body html if available, otherwise return the full html
		const html = $("body")?.html() ?? $.html();

		return { html, mermaidBlocks, d2Blocks };
	}, [content]);

	// Render mermaid and d2 diagrams asynchronously
	useEffect(() => {
		if (mermaidBlocks.length === 0 && d2Blocks.length === 0) {
			setRenderedContent(html);
			return;
		}

		let isCancelled = false;

		const renderDiagrams = async () => {
			try {
				let updatedHtml = html;

				// Render all mermaid diagrams
				if (mermaidBlocks.length > 0) {
					// Initialize mermaid
					mermaid.initialize({
						startOnLoad: false,
						theme: "default",
						securityLevel: "loose",
					});

					for (const block of mermaidBlocks) {
						if (isCancelled) return;
						updatedHtml = await renderMermaidDiagram(block, updatedHtml);
					}
				}

				// Render all D2 diagrams
				if (d2Blocks.length > 0) {
					for (const block of d2Blocks) {
						if (isCancelled) return;
						updatedHtml = await renderD2Diagram(block, updatedHtml);
					}
				}

				if (!isCancelled) {
					setRenderedContent(updatedHtml);
				}
			} catch (error) {
				console.error("Failed to render diagrams:", error);
				if (!isCancelled) {
					setRenderedContent(html);
				}
			}
		};

		renderDiagrams();

		return () => {
			isCancelled = true;
		};
	}, [html, mermaidBlocks, d2Blocks]);

	return (
		<Typography
			className={`tiptap ${className || ""}`.trim()}
			style={{
				maxWidth: "100%",
				wordBreak: "break-word",
				...boxProps.style,
			}}
			{...boxProps}
			/** biome-ignore lint/security/noDangerouslySetInnerHtml: content should be sanitized before passing to this component */
			dangerouslySetInnerHTML={{ __html: renderedContent || html }}
		/>
	);
}
