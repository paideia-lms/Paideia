# Incident Report: TypeScript Duplicate Export Conflicts in Monorepo Package

**Date**: March 3, 2026  
**Severity**: Medium (blocks typecheck)  
**Affected**: `packages/paideia-backend`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-001

## Summary

When consolidating the backend package (`@paideia/paideia-backend`), typecheck failed with two related TypeScript errors:

1. **TS2308**: "Module X has already exported a member named 'Y'. Consider explicitly re-exporting to resolve the ambiguity."
2. **TS1205**: "Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'."

These occurred in `packages/paideia-backend/src/index.ts` when re-exporting from `./json/raw-quiz-config/v2` and `./internal/quiz-module-management`, which both exported types with identical names (e.g. `AddPageArgs`, `AddNestedQuizArgs`).

## Impact

**Symptoms**:
- `bun typecheck` in `packages/paideia-backend` failed with 30+ TS2308 errors
- Each conflicting type name produced a separate error
- Build/CI would fail until resolved

**Root Cause**:
- `quiz-module-management` defines `AddPageArgs` etc. extending `BaseInternalFunctionArgs` (payload, user, etc.)
- `json/raw-quiz-config/v2` defines `AddPageArgs` etc. for pure config operations (config, nestedQuizId, etc.)
- Both modules were re-exported via `export *` in the main index, causing name collisions

## Resolution

### Fix 1: Explicit Exports (Exclude Conflicting Types)

Replace `export * from "./json/raw-quiz-config/v2"` with explicit exports that **exclude** the conflicting `*Args` interfaces:

```typescript
// Export types (no *Args - those come from quiz-module-management)
export type {
  QuizResource, QuestionType, Question, QuizConfig, NestedQuizConfig, ...
} from "./json/raw-quiz-config/v2";

// Export values (functions, classes)
export {
  getQuestionPoints, calculateTotalPoints, createDefaultQuizConfig,
  QuizConfigValidationError, QuizElementNotFoundError, addPage, removePage, ...
} from "./json/raw-quiz-config/v2";
```

Consumers needing the raw config `*Args` types can import from the subpath:
`@paideia/paideia-backend/json/raw-quiz-config/v2`

### Fix 2: isolatedModules and `export type`

With `isolatedModules: true`, TypeScript requires type-only re-exports to use `export type`:

```typescript
// ✅ Correct
export type { QuizConfig, NestedQuizConfig } from "./json/raw-quiz-config/v2";
export { calculateTotalPoints } from "./json/raw-quiz-config/v2";

// ❌ Fails with TS1205
export { type QuizConfig, calculateTotalPoints } from "./json/raw-quiz-config/v2";
```

Split into two statements: one `export type { ... }` for types, one `export { ... }` for values.

## Prevention

**When adding re-exports in a package index**:
1. Check if multiple source modules export types with the same name
2. Prefer explicit exports over `export *` when name collisions are possible
3. With `isolatedModules`, use `export type` for type-only re-exports
4. Add subpath exports in package.json for modules with many exports that may conflict

**Package.json subpath**:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./json/raw-quiz-config/v2": "./src/json/raw-quiz-config/v2.ts"
  }
}
```

## References

- Changelog: `changelogs/0094-2026-03-02-bun-monorepo-restructure.md`
- Affected file: `packages/paideia-backend/src/index.ts`
- Related: `packages/paideia-backend/tsconfig.json` (`isolatedModules: true`)

## Status

✅ **RESOLVED** - Explicit exports and `export type` split applied; typecheck passes.
