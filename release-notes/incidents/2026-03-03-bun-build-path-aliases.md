# Incident Report: Bun.build Cannot Resolve Path Aliases for Workspace Packages

**Date**: March 3, 2026  
**Severity**: High (blocks production build)  
**Affected**: `apps/paideia` build, `packages/paideia-backend` when bundled  
**Status**: Resolved (workaround)  
**Incident ID**: INC-2026-03-03-003

## Summary

When running `bun run build` in `apps/paideia`, the build failed with:

```
error: Could not resolve: "app/utils/router/route-params-schema". Maybe you need to "bun install"?
error: Could not resolve: "server/json/course-module-settings/version-resolver". Maybe you need to "bun install"?
```

TypeScript compiles successfully (tsconfig paths work), but Bun.build does not fully apply tsconfig path mappings when bundling workspace package sources. The app uses `app/*`, `server/*` aliases; the backend package uses `server/*`, `app/utils/error`, `src/*` aliases. When Bun bundles the server entrypoint and follows imports into `@paideia/paideia-backend`, it encounters these aliases and cannot resolve them.

## Impact

**Symptoms**:
- `bun run build` fails immediately with "Could not resolve" for path-alias imports
- Typecheck passes; only the build step fails
- Affects both app server imports and backend package internal imports

**Root Cause**:
- TypeScript path aliases are compile-time only; they do not affect runtime/bundler resolution
- Bun.build's `tsconfig` option applies to the entrypoint's project, but when bundling workspace packages (e.g. `@paideia/paideia-backend`), the bundler processes those package sources without applying their tsconfig
- The backend package exports raw `.ts` source; when bundled, its internal `server/*` imports are not resolved

## Resolution

### Fix 1: App Server – Use Relative Imports

Replace path aliases with relative imports in `server/` so the bundler can resolve them without tsconfig:

```typescript
// ❌ Fails at build - Bun doesn't resolve app/* for server files
import { parseParams } from "app/utils/router/route-params-schema";

// ✅ Works - relative path
import { parseParams } from "../app/utils/router/route-params-schema";
```

### Fix 2: Backend Path Aliases – Bun Build Plugin

Add a resolver plugin to `scripts/build.ts` that intercepts `server/*`, `app/utils/error`, `src/*` imports when the importer is from the backend package, and resolves them to `packages/paideia-backend/src/*`:

```typescript
const backendPathResolver: import("bun").BunPlugin = {
  name: "backend-path-resolver",
  setup(build) {
    build.onResolve(
      { filter: /^(server\/|app\/utils\/error|src\/)/ },
      (args) => {
        if (!args.importer?.includes("paideia-backend")) return undefined;
        const resolved = resolveBackendPath(args.path);
        return resolved ? { path: resolved } : undefined;
      },
    );
  },
};
```

Handle `server/collections` → `src/collections/index.ts`, `server/json/...` → `src/json/...`, etc.

### Fix 3: tsconfig Paths – Avoid Catch-All

The catch-all `"*": ["./*"]` in tsconfig overrides npm package resolution (e.g. `nuqs`, `@fullcalendar/core`). Use explicit path patterns instead:

```json
{
  "paths": {
    "app/*": ["./app/*"],
    "server/*": ["./server/*"],
    "~/*": ["./app/*"]
  }
}
```

## Caveats

- **Package boundary**: The plugin resolves directly into `packages/paideia-backend`, which couples the build to the monorepo layout. A more ideal approach would keep the backend abstracted via the package boundary (e.g. pre-bundled backend output).
- **Maintenance**: When adding new backend path aliases, update the resolver plugin.

## Prevention

1. **App server**: Prefer relative imports for `server/` files that are bundled; path aliases work for typecheck but not for Bun.build.
2. **Backend**: If the backend were pre-built (compiled to JS with resolved paths), the app build would not need the plugin. Consider a backend build step for future simplification.
3. **tsconfig**: Avoid `"*": ["./*"]`; use explicit path patterns so npm packages resolve from node_modules.

## References

- Changelog: `changelogs/0094-2026-03-02-bun-monorepo-restructure.md`
- Build script: `apps/paideia/scripts/build.ts`
- Skill: `.cursor/skills/bun-build-monorepo/SKILL.md`

## Status

✅ **RESOLVED** (workaround) - Build succeeds with resolver plugin and relative imports. Consider backend pre-build for a cleaner long-term solution.
