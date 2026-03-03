---
name: typescript-monorepo-exports
description: Resolve TypeScript export conflicts and isolatedModules requirements in monorepo packages. Use when package index re-exports cause TS2308 (duplicate member) or TS1205 (export type required) errors.
---

# TypeScript Monorepo Export Patterns

## When to Use

- Package index uses `export *` from multiple modules
- Typecheck fails with TS2308: "Module X has already exported a member named 'Y'"
- Typecheck fails with TS1205: "Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'"

## TS2308: Duplicate Export Conflicts

**Cause**: Two or more source modules export types/functions with the same name. Re-exporting both via `export *` causes ambiguity.

**Solution**: Use explicit exports and exclude conflicting names from one source.

```typescript
// ❌ Fails - both quiz-module-management and v2 export AddPageArgs
export * from "./internal/quiz-module-management";
export * from "./json/raw-quiz-config/v2";

// ✅ Fix - explicit exports from v2, exclude *Args (quiz-module-management has those)
export type { QuizConfig, NestedQuizConfig, Question, ... } from "./json/raw-quiz-config/v2";
export { calculateTotalPoints, createDefaultQuizConfig, addPage, ... } from "./json/raw-quiz-config/v2";
```

**Alternative**: Add a subpath export so consumers can import conflicting types directly:

```json
// package.json
"exports": {
  ".": "./src/index.ts",
  "./json/raw-quiz-config/v2": "./src/json/raw-quiz-config/v2.ts"
}
```

## TS1205: isolatedModules and export type

**Cause**: With `isolatedModules: true`, TypeScript cannot infer type-only vs value exports from a single `export { type X, Y }` statement.

**Solution**: Split type exports and value exports into separate statements:

```typescript
// ❌ May fail with TS1205
export { type QuizConfig, calculateTotalPoints } from "./v2";

// ✅ Correct
export type { QuizConfig, NestedQuizConfig } from "./v2";
export { calculateTotalPoints, createDefaultQuizConfig } from "./v2";
```

## Checklist

1. Identify which modules export the conflicting names
2. Decide which module "owns" each name for the main package export
3. Use explicit `export type { ... }` and `export { ... }` instead of `export *`
4. Add subpath exports for modules that need full access (including conflicting types)
5. Run typecheck to verify: `bun typecheck` or `tsc --noEmit`

## Reference

See incident report: `release-notes/incidents/2026-03-03-typescript-duplicate-export-conflicts.md`
