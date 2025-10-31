import type { CodeHighlightAdapterProvider } from '@mantine/code-highlight';
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

type CodeHighlightAdapter = Parameters<typeof CodeHighlightAdapterProvider>[0]['adapter']

// Create and configure lowlight instance with all registered languages
const lowlight = createLowlight();

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

// Custom lowlight adapter for Mantine CodeHighlight
export const customLowlightAdapter: CodeHighlightAdapter = {
	getHighlighter: () => {
		return ({ code, language }) => {
			// If no language is specified, return unhighlighted code
			if (!language) {
				return {
					highlightedCode: code,
					isHighlighted: false,
				};
			}

			try {
				// Check if language is registered
				if (lowlight.registered(language)) {
					// Highlight the code using lowlight
					const tree = lowlight.highlight(language, code);
					// Convert the AST tree to HTML
					const highlightedCode = toHtml(tree);
					return {
						highlightedCode,
						isHighlighted: true,
					};
				}

				// Language not registered, return unhighlighted code
				return {
					highlightedCode: code,
					isHighlighted: false,
				};
			} catch (error) {
				// If highlighting fails, return unhighlighted code
				console.warn(
					`Failed to highlight code block with language: ${language}`,
					error,
				);
				return {
					highlightedCode: code,
					isHighlighted: false,
				};
			}
		};
	},
};

