/**
 * Utility functions for parsing and validating fill-in-the-blank questions
 */

/**
 * Checks if a string is in snake_case format
 */
function isSnakeCase(str: string): boolean {
    return /^[a-z]+(_[a-z]+)*$/.test(str);
}

/**
 * Checks if a string is in CONSTANT_CASE format
 */
function isConstantCase(str: string): boolean {
    return /^[A-Z]+(_[A-Z]+)*$/.test(str);
}

/**
 * Validates that a blank ID is in snake_case or CONSTANT_CASE
 */
export function isValidBlankId(id: string): boolean {
    return isSnakeCase(id) || isConstantCase(id);
}

/**
 * Parses a fill-in-the-blank prompt and extracts blank IDs
 * Returns an object with unique blank IDs and validation errors
 */
export interface ParsedFillInTheBlank {
    /** All blank IDs found in the prompt (in order of appearance) */
    blankIds: string[];
    /** Unique blank IDs (in order of first appearance) */
    uniqueBlankIds: string[];
    /** Invalid blank IDs that don't match snake_case or CONSTANT_CASE */
    invalidBlankIds: string[];
    /** Whether all blank IDs are valid */
    isValid: boolean;
}

/**
 * Parses a fill-in-the-blank prompt to extract and validate blank IDs
 * 
 * @param prompt - The prompt string containing {{blank_id}} markers
 * @returns Parsed information about the blanks in the prompt
 * 
 * @example
 * ```ts
 * const result = parseFillInTheBlank("The capital is {{capital}} and {{capital}}.");
 * // result.blankIds = ["capital", "capital"]
 * // result.uniqueBlankIds = ["capital"]
 * // result.isValid = true
 * ```
 */
export function parseFillInTheBlank(prompt: string): ParsedFillInTheBlank {
    // Extract all blank IDs from {{...}} markers
    const blankMatches = Array.from(prompt.matchAll(/\{\{([^}]+)\}\}/g));
    const blankIds = blankMatches.map((match) => match[1].trim());

    // Get unique blank IDs in order of first appearance
    const uniqueBlankIds: string[] = [];
    const seen = new Set<string>();

    for (const blankId of blankIds) {
        if (!seen.has(blankId)) {
            uniqueBlankIds.push(blankId);
            seen.add(blankId);
        }
    }

    // Validate blank IDs
    const invalidBlankIds = uniqueBlankIds.filter((id) => !isValidBlankId(id));
    const isValid = invalidBlankIds.length === 0;

    return {
        blankIds,
        uniqueBlankIds,
        invalidBlankIds,
        isValid,
    };
}

/**
 * Splits a prompt into parts, separating text from blank markers
 * Useful for rendering the prompt with input fields
 * 
 * @param prompt - The prompt string containing {{blank_id}} markers
 * @returns Array of parts, where each part is either text or a blank ID
 * 
 * @example
 * ```ts
 * const parts = splitPromptIntoParts("Hello {{name}}, you are {{age}} years old.");
 * // parts = ["Hello ", "name", ", you are ", "age", " years old."]
 * ```
 */
export function splitPromptIntoParts(prompt: string): Array<{
    type: "text" | "blank";
    content: string;
}> {
    const parts = prompt.split(/(\{\{[^}]+\}\})/g);

    return parts
        .filter((part) => part.length > 0)
        .map((part) => {
            const blankMatch = part.match(/^\{\{([^}]+)\}\}$/);
            if (blankMatch) {
                return {
                    type: "blank" as const,
                    content: blankMatch[1].trim(),
                };
            }
            return {
                type: "text" as const,
                content: part,
            };
        });
}

