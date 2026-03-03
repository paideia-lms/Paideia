---
name: tsconfig-monorepo
description: Consolidate shared TypeScript options in monorepo root tsconfig. Use when adding new packages, aligning compiler options, or avoiding duplication across apps/packages.
---

# tsconfig Consolidation in Monorepo

## When to Use

- Multiple `tsconfig.json` files with duplicated options
- Adding a new app or package to the monorepo
- Need consistent compiler options across workspace

## Pattern

**Root `tsconfig.json`**: Shared options only. Avoid catch-all `"*": ["./*"]`—it overrides npm package resolution (e.g. `nuqs`, `@fullcalendar/core`).

```json
{
  "compilerOptions": {
    "isolatedModules": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@mantine/form/lib/paths.types": ["./node_modules/@mantine/form/lib/paths.types"]
    }
  }
}
```

**Child `tsconfig.json`** (app or package): Extend root, add only app-specific options.

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["bun", "vite/client"],
    "paths": {
      "~/*": ["./app/*"]
    }
  },
  "include": ["."],
  "exclude": ["node_modules", "dist"]
}
```

## Guidelines

1. **Root**: `target`, `module`, `strict`, `isolatedModules`, `paths` for workspace-wide aliases. Do not use `"*": ["./*"]`—it breaks npm resolution.
2. **App**: `lib`, `types`, `jsx`, `rootDirs`, app-specific `paths`
3. **Package**: `lib`, `types`, package-specific `paths` (e.g. `server/*`, `app/utils/error`)
4. Avoid hardcoded `../../` in paths; use root paths or relative from package root

## Reference

- Changelog: `changelogs/0094-2026-03-02-bun-monorepo-restructure.md`
- Root: `tsconfig.json`, App: `apps/paideia/tsconfig.json`, Backend: `packages/paideia-backend/tsconfig.json`
