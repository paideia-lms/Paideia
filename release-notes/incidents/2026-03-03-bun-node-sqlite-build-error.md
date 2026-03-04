# Incident Report: Bun Build Fails with "No such built-in module: node:sqlite"

**Date**: March 3, 2026  
**Severity**: High (blocks production build)  
**Affected**: `apps/paideia` compiled binary  
**Status**: Resolved (workaround)  
**Incident ID**: INC-2026-03-03-006

## Summary

When running the compiled Paideia binary (`./dist/paideia`), the process crashes immediately with:

```
error: No such built-in module: node:sqlite
Bun v1.3.10 (macOS arm64)
```

The build completes successfully, but the binary fails at runtime. Bun does not implement `node:sqlite` (Node.js 22.6+ built-in); it provides `bun:sqlite` instead. Paideia uses PostgreSQL only via `@payloadcms/db-postgres` and never uses SQLite.

## Impact

**Symptoms**:
- `bun run build` succeeds
- `./dist/paideia server` fails immediately with "No such built-in module: node:sqlite"
- No direct imports of `node:sqlite` in the codebase

**Root Cause**:
- A transitive dependency (likely drizzle-orm, payload, or @types/node) references `node:sqlite`
- When the bundler includes more of the dependency tree (e.g. after adding oRPC OpenAPI imports), it pulls in code paths that require `node:sqlite`
- Tree shaking does not eliminate these references because the bundler cannot statically prove the SQLite path is never taken
- Bun does not implement `node:sqlite`; it has `bun:sqlite` instead

## Resolution (Workaround)

Add a Bun build plugin that resolves `node:sqlite` to a stub module. The stub satisfies the import so the bundler does not fail, and the stub is never actually used at runtime (we use PostgreSQL only).

### 1. Create Stub Module

Create `apps/paideia/scripts/stubs/node-sqlite-stub.ts`:

```typescript
/**
 * Stub for node:sqlite - Bun does not implement node:sqlite.
 * Used when bundling to prevent "No such built-in module: node:sqlite" errors.
 * We use PostgreSQL only; this stub satisfies any accidental imports from
 * transitive deps (e.g. drizzle-orm adapters, @types/node).
 */
export default {};
export const DatabaseSync = class {};
export const constants = {};
```

### 2. Add Build Plugin

In `apps/paideia/scripts/build.ts`, add a plugin before the `Bun.build` call:

```typescript
/** Stub node:sqlite - Bun doesn't implement it; we use PostgreSQL only. */
const nodeSqliteStub = resolve(process.cwd(), "scripts/stubs/node-sqlite-stub.ts");
const nodeSqliteStubPlugin: import("bun").BunPlugin = {
  name: "node-sqlite-stub",
  setup(build) {
    build.onResolve({ filter: /^node:sqlite$/ }, () => ({
      path: nodeSqliteStub,
    }));
  },
};

// In Bun.build config:
plugins: [backendPathResolver, nodeSqliteStubPlugin],
```

## Caveats

- **Workaround, not fix**: The real fix would be for the upstream dependency to avoid importing `node:sqlite` when not using SQLite, or for Bun to implement `node:sqlite` compatibility.
- **Stub is inert**: The stub exports empty values; any code that actually tried to use SQLite would fail. Since we only use PostgreSQL, this is acceptable.
- **Future changes**: If a dependency is updated and no longer references `node:sqlite`, the stub becomes redundant but harmless.

## Prevention

1. **Avoid broad imports**: Import only what you need from large packages (e.g. payload, drizzle) to reduce the chance of pulling in unused adapter code.
2. **Lazy loading**: Consider dynamic imports for optional features (e.g. OpenAPI handler) so they are in separate chunks and may tree-shake differently.
3. **Monitor deps**: When adding new dependencies or expanding imports, run `bun run build && ./dist/paideia server` to catch similar issues early.

## References

- Build script: `apps/paideia/scripts/build.ts`
- Stub: `apps/paideia/scripts/stubs/node-sqlite-stub.ts`
- Skill: `.cursor/skills/bun-build-monorepo/SKILL.md`
- Bun node:sqlite: https://bun.sh/reference/node/sqlite (marked "Not implemented")

## Status

✅ **RESOLVED** (workaround) - Binary starts successfully with stub plugin. Consider upstream fixes or Bun implementing `node:sqlite` for a proper solution.
