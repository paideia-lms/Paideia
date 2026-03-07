# Incident Report: search-query-parser TypeScript Declaration

**Date**: March 7, 2026  
**Severity**: Low (typecheck fails without declaration)  
**Affected**: `packages/module-user/src/services/user-management.ts`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-07-003

## Summary

Importing `search-query-parser` causes:

```
error TS2307: Cannot find module 'search-query-parser' or its corresponding type declarations.
error TS2339: Property 'parse' does not exist on type '(query: string, options?: ...) => ParsedQuery'.
```

The package does not ship TypeScript types. Additionally, the default export is an **object with a `parse` method**, not the `parse` function itself. A naive declaration like `export default function parse(...)` leads to `Property 'parse' does not exist` when code calls `searchQueryParser.parse(query, options)`.

## Impact

**Symptoms**:
- `bun run typecheck` fails in packages using `search-query-parser`
- Code uses `searchQueryParser.parse(query, { keywords: ["role"] })` — the package API is `require("search-query-parser").parse(...)`

**Root Cause**:
- Package has no `@types/search-query-parser` on DefinitelyTyped
- Default export is `{ parse: function, stringify: function, ... }`, not the parse function directly

## Resolution

Backend module packages do not use Vite—do not put declarations in `vite-env.d.ts`. If types are needed, add a `.d.ts` in the package (e.g. `src/types.d.ts`). Note: in some setups, types may work without a declaration (e.g. package has built-in types or resolution differs).

If a declaration is required, add to `src/types.d.ts` (not vite-env.d.ts):

```typescript
declare module "search-query-parser" {
  interface ParsedQuery {
    text?: string | string[];
    [key: string]: string | string[] | object | undefined;
  }
  interface SearchQueryParser {
    parse(
      query: string,
      options?: { keywords?: string[] },
    ): ParsedQuery | string;
  }
  const searchQueryParser: SearchQueryParser;
  export default searchQueryParser;
}
```

**Usage** (unchanged):
```typescript
import searchQueryParser from "search-query-parser";
const parsed = searchQueryParser.parse(query, { keywords: ["role"] });
```

## Prevention

When adding packages without TypeScript types:
1. Check npm for `@types/<package>` — if missing, add a `declare module` block
2. Inspect the package's actual export shape (default export vs named exports, object vs function)
3. Match the declaration to the runtime API

## References

- Package: https://www.npmjs.com/package/search-query-parser
- Usage: `packages/module-user/src/services/user-management.ts`
- Declaration: Use `src/types.d.ts` in backend packages (not vite-env.d.ts)
- Skill: `.cursor/skills/module-package-refactoring/SKILL.md`

## Status

✅ **RESOLVED** - Module declaration added; typecheck passes.
