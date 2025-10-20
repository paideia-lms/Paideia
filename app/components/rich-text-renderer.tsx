import { Typography, type TypographyProps } from "@mantine/core";
import { useMemo } from "react";
import { createLowlight } from "lowlight";
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
import { mermaidGrammar } from "lowlight-mermaid";
import { toHtml } from "hast-util-to-html";
import * as cheerio from "cheerio";
import { decode } from "entities";

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
lowlight.register("markdown", markdown);
lowlight.register("mermaid", mermaidGrammar);

interface RichTextRendererProps extends Omit<TypographyProps, "dangerouslySetInnerHTML"> {
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
    const highlightedContent = useMemo(() => {
        // Parse the HTML content
        const $ = cheerio.load(decode(content));

        // Find all code blocks with language classes
        $("pre code[class*='language-']").each((_, element) => {
            const $code = $(element);

            // Extract language from class name (e.g., "language-python" -> "python")
            const classList = $code.attr("class")?.split(" ") || [];
            const languageClass = classList.find((cls) => cls.startsWith("language-"));

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
                    console.log("highlightedHtml: ", highlightedHtml);
                    $code.html(highlightedHtml);
                }
            } catch (error) {
                console.warn(`Failed to highlight code block with language: ${language}`, error);
            }
        });

        const html = $.html();
        return html;

    }, [content]);

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
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
    );
}

