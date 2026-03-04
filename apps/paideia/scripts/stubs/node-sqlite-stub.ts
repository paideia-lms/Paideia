/**
 * Stub for node:sqlite - Bun does not implement node:sqlite.
 * Used when bundling to prevent "No such built-in module: node:sqlite" errors.
 * We use PostgreSQL only; this stub satisfies any accidental imports from
 * transitive deps (e.g. drizzle-orm adapters, @types/node).
 */
export default {};
export const DatabaseSync = class {};
export const constants = {};
