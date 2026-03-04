---
name: bun-build-monorepo
description: Fix Bun.build issues in monorepos. Use when build fails with "Could not resolve" for path aliases, or "No such built-in module: node:sqlite" when running the compiled binary.
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

### 4. node:sqlite Stub (Runtime Error After Build)

When the build succeeds but the compiled binary fails with:

```
error: No such built-in module: node:sqlite
```

Bun does not implement `node:sqlite`. A transitive dependency (drizzle, payload, etc.) may reference it. Add a stub plugin to resolve `node:sqlite` to an empty module:

```typescript
const nodeSqliteStub = resolve(process.cwd(), "scripts/stubs/node-sqlite-stub.ts");
const nodeSqliteStubPlugin: import("bun").BunPlugin = {
  name: "node-sqlite-stub",
  setup(build) {
    build.onResolve({ filter: /^node:sqlite$/ }, () => ({ path: nodeSqliteStub }));
  },
};
```

Stub file: `scripts/stubs/node-sqlite-stub.ts` exports `default {}`, `DatabaseSync`, `constants`. See incident report for full stub.

## Checklist

1. Identify which imports fail at build (check error message)
2. For app server: convert to relative imports
3. For workspace package: add resolver plugin or pre-build the package
4. For node:sqlite runtime error: add stub plugin
5. Verify: `bun run build` and `./dist/paideia server`

## Reference

- Incident (path aliases): `release-notes/incidents/2026-03-03-bun-build-path-aliases.md`
- Incident (node:sqlite): `release-notes/incidents/2026-03-03-bun-node-sqlite-build-error.md`
- Build script: `apps/paideia/scripts/build.ts`
