import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { useCallback } from "react";
import { href, useFetcher } from "react-router";
import z from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { badRequest } from "~/utils/responses";
import type { Route } from "./+types/d2-render";
import { globalContextKey } from "server/contexts/global-context";

const execAsync = promisify(exec);

const inputSchema = z.object({
    code: z.string().min(1, "D2 code cannot be empty"),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
    const { unstorage } = context.get(globalContextKey);
    const { data } = await getDataAndContentTypeFromRequest(request);

    const parsed = inputSchema.safeParse(data);

    if (!parsed.success) {
        return badRequest({ error: z.treeifyError(parsed.error) });
    }

    const { code } = parsed.data;

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
        return { svg: cachedSvg as string };
    }

    try {
        // Ensure temp directory exists
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }

        // Write D2 code to temporary file
        writeFileSync(inputPath, code, "utf-8");

        // Execute D2 CLI to convert D2 to SVG
        // Use --theme=0 for default theme and --sketch=false for clean output
        const { stderr } = await execAsync(
            `d2 --theme=0 --sketch=false "${inputPath}" "${outputPath}"`,
            {
                timeout: 10000, // 10 second timeout
            },
        );

        if (stderr && !existsSync(outputPath)) {
            console.error("D2 compilation error:", stderr);
            return badRequest({
                error: `D2 compilation failed: ${stderr}`,
            });
        }

        // Read the generated SVG
        const svg = readFileSync(outputPath, "utf-8");

        // Store the SVG in the cache
        await unstorage.setItem(`d2-${uniqueId}.svg`, svg);

        // throw new Error("test");

        // Return the SVG
        return { svg };
    } catch (error) {
        console.error("Error processing D2 code:", error);
        return badRequest({
            error:
                error instanceof Error
                    ? `Error processing D2 code: ${error.message}`
                    : "Unknown error processing D2 code",
        });
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
};

export interface UseD2DiagramOptions {
    onSuccess?: (svg: string) => void;
    onError?: (error: string) => void;
}

/**
 * Custom hook for rendering D2 diagrams via the backend API
 * 
 * @example
 * ```tsx
 * const { renderD2, svg, loading, error } = useD2Diagram();
 * 
 * // Render a diagram
 * renderD2("x -> y: hello world");
 * 
 * // Display the result
 * {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
 * ```
 */
export function useD2Diagram(options: UseD2DiagramOptions = {}) {
    const fetcher = useFetcher<typeof action>();

    const renderD2 = useCallback(
        (code: string) => {
            fetcher.submit(
                { code },
                {
                    method: "POST",
                    action: href("/api/d2-render"),
                    encType: "application/json",
                }
            );
        },
        [fetcher]
    );

    // Extract SVG from successful response
    const svg = fetcher.data && "svg" in fetcher.data ? fetcher.data.svg : null;

    // Extract error from failed response
    const error =
        fetcher.data && "error" in fetcher.data
            ? typeof fetcher.data.error === "string"
                ? fetcher.data.error
                : JSON.stringify(fetcher.data.error)
            : null;

    // Call callbacks when status changes
    if (svg && options.onSuccess) {
        options.onSuccess(svg);
    }
    if (error && options.onError) {
        options.onError(error);
    }

    return {
        renderD2,
        svg,
        loading: fetcher.state !== "idle",
        error,
        state: fetcher.state,
    };
}

export async function renderD2(code: string) {
    const response = await fetch(href("/api/d2-render"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
    });

    const data = await response.json() as Promise<{ svg: string } | { error: string }>;

    return data;
}
