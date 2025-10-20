import { Typography, type TypographyProps } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
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
import mermaid from "mermaid";

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

    // Process content and extract mermaid diagrams
    const { html, mermaidBlocks } = useMemo(() => {
        const decoded = decode(content);
        const $ = cheerio.load(decoded);
        const mermaidBlocks: Array<{ id: string; code: string }> = [];

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

        // SECOND: Process all other code blocks with lowlight
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
                    $code.html(highlightedHtml);
                }
            } catch (error) {
                console.warn(`Failed to highlight code block with language: ${language}`, error);
            }
        });

        // Get the body html if available, otherwise return the full html
        const html = $("body")?.html() ?? $.html();

        return { html, mermaidBlocks };
    }, [content]);

    // Render mermaid diagrams asynchronously
    useEffect(() => {
        if (mermaidBlocks.length === 0) {
            setRenderedContent(html);
            return;
        }

        let isCancelled = false;

        const renderMermaidDiagrams = async () => {
            try {
                // Initialize mermaid
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "default",
                    securityLevel: "loose",
                });

                let updatedHtml = html;

                // Render all mermaid diagrams
                for (const block of mermaidBlocks) {
                    try {
                        const { svg } = await mermaid.render(block.id, block.code);

                        if (isCancelled) return;

                        // Replace placeholder with rendered SVG
                        const $ = cheerio.load(updatedHtml);
                        const placeholder = $(`[data-mermaid-id="${block.id}"]`);
                        placeholder.html(svg);
                        updatedHtml = $("body")?.html() ?? $.html();
                    } catch (error) {
                        console.error(`Failed to render mermaid diagram ${block.id}:`, error);

                        if (isCancelled) return;

                        // Replace placeholder with error message
                        const $ = cheerio.load(updatedHtml);
                        const placeholder = $(`[data-mermaid-id="${block.id}"]`);
                        placeholder.html(`
                            <div style="color: var(--mantine-color-red-6); padding: 1rem; border: 1px solid var(--mantine-color-red-6); border-radius: 4px;">
                                <strong>Mermaid Rendering Error:</strong><br/>
                                ${error instanceof Error ? error.message : "Unknown error"}
                            </div>
                        `);
                        updatedHtml = $("body")?.html() ?? $.html();
                    }
                }

                if (!isCancelled) {
                    setRenderedContent(updatedHtml);
                }
            } catch (error) {
                console.error("Failed to initialize mermaid:", error);
                if (!isCancelled) {
                    setRenderedContent(html);
                }
            }
        };

        renderMermaidDiagrams();

        return () => {
            isCancelled = true;
        };
    }, [html, mermaidBlocks]);

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

