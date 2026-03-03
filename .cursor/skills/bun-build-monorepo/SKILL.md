---
name: bun-build-monorepo
description: Fix Bun.build path alias resolution in monorepos. Use when build fails with "Could not resolve" for app/*, server/*, or workspace package path aliases while typecheck passes.
---

# Bun.build Path Aliases in Monorepo

## When to Use

- `bun run build` fails with "Could not resolve: app/utils/..." or "server/..."
- TypeScript typecheck passes (tsconfig paths work)
- App bundles a server entrypoint that imports from workspace packages

## Cause

Bun.build does not fully apply tsconfig path mappings when bundling workspace package sources. The `tsconfig` option applies to the entrypoint's project, but when the bundler follows imports into `@paideia/paideia-backend` (or similar), it processes those package sources without applying their tsconfig.

## Solutions

### 1. App Server – Relative Imports

For files in `server/` that are bundled, use relative imports instead of path aliases:

```typescript
// ❌ Fails at build
import { parseParams } from "app/utils/router/route-params-schema";

// ✅ Works
import { parseParams } from "../app/utils/router/route-params-schema";
```

### 2. Backend Path Aliases – Resolver Plugin

When the backend package uses `server/*`, `app/utils/error`, `src/*` and is exported as raw `.ts` source, add a Bun plugin to resolve these when the importer is from the backend:

```typescript
build.onResolve(
  { filter: /^(server\/|app\/utils\/error|src\/)/ },
  (args) => {
    if (!args.importer?.includes("paideia-backend")) return undefined;
    const resolved = resolveBackendPath(args.path);
    return resolved ? { path: resolved } : undefined;
  },
);
```

Handle `server/collections` → `src/collections/index.ts`, `server/json/...` → `src/json/...`, etc.

### 3. tsconfig – Avoid Catch-All

The path `"*": ["./*"]` overrides npm resolution. Use explicit patterns:

```json
"paths": {
  "app/*": ["./app/*"],
  "server/*": ["./server/*"]
}
```

## Checklist

1. Identify which imports fail at build (check error message)
2. For app server: convert to relative imports
3. For workspace package: add resolver plugin or pre-build the package
4. Verify: `bun run build`

## Reference

- Incident report: `release-notes/incidents/2026-03-03-bun-build-path-aliases.md`
- Build script: `apps/paideia/scripts/build.ts`
