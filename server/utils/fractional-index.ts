/**
 * Fractional indexing utility for ordering items in a tree structure
 * Similar to Docmost's implementation but simplified for our use case
 */

/**
 * Generates a lexicographic key between two keys
 * @param after - The key that should come before the new key (null for first position)
 * @param before - The key that should come after the new key (null for last position)
 * @returns A new key positioned between the two given keys
 */
export function generateKeyBetween(
    after: string | null,
    before: string | null,
): string {
    // Handle edge cases
    if (after === null && before === null) {
        return "a";
    }

    if (after === null) {
        return generateKeyBefore(before);
    }

    if (before === null) {
        return generateKeyAfter(after);
    }

    // Both keys exist, find a key between them
    return generateKeyBetweenKeys(after, before);
}

/**
 * Generates a key that comes after the given key
 */
function generateKeyAfter(after: string): string {
    // Simple approach: append 'a' to the key
    return after + "a";
}

/**
 * Generates a key that comes before the given key
 */
function generateKeyBefore(before: string): string {
    // If the key starts with 'a', prepend 'z'
    if (before.startsWith("a")) {
        return "z" + before;
    }

    // Otherwise, replace the first character with the previous letter
    const firstChar = before[0];
    const prevChar = String.fromCharCode(firstChar.charCodeAt(0) - 1);
    return prevChar + before.slice(1);
}

/**
 * Generates a key between two existing keys
 */
function generateKeyBetweenKeys(after: string, before: string): string {
    // Find the first position where the keys differ
    let i = 0;
    while (i < after.length && i < before.length && after[i] === before[i]) {
        i++;
    }

    // If after is a prefix of before, we can insert between them
    if (i === after.length) {
        return after + "a";
    }

    // If before is a prefix of after, we need to modify after
    if (i === before.length) {
        return generateKeyBefore(after);
    }

    // Keys differ at position i
    const afterChar = after[i];
    const beforeChar = before[i];

    // If there's room between the characters, use the middle
    if (beforeChar.charCodeAt(0) - afterChar.charCodeAt(0) > 1) {
        const middleChar = String.fromCharCode(
            Math.floor((afterChar.charCodeAt(0) + beforeChar.charCodeAt(0)) / 2),
        );
        return after.slice(0, i) + middleChar;
    }

    // No room between characters, extend the after key
    return after.slice(0, i + 1) + "a";
}

/**
 * Validates that a key is a valid fractional index
 */
export function isValidFractionalKey(key: string): boolean {
    return typeof key === "string" && key.length > 0 && /^[a-z]+$/.test(key);
}

/**
 * Sorts an array of objects by their fractional key
 */
export function sortByFractionalKey<T extends { position?: string }>(
    items: T[],
): T[] {
    return items.sort((a, b) => {
        const aPos = a.position || "a";
        const bPos = b.position || "a";
        return aPos.localeCompare(bPos);
    });
}
