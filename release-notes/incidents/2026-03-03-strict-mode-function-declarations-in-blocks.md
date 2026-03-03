# Incident Report: Function Declarations Not Allowed Inside Blocks in Strict Mode (ES5)

**Date**: March 3, 2026  
**Severity**: Medium (blocks lint-project script)  
**Affected**: `packages/paideia-backend/linter.config.ts`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-002

## Summary

When running the custom lint script (`bun packages/paideia-backend/scripts/lint-project.ts`), TypeScript compilation of `linter.config.ts` failed with:

```
Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'. Modules are automatically in strict mode.
```

The linter config uses the TypeScript compiler API and defines several helper functions **inside** blocks (e.g. inside `if` branches, `for` loops, or callback bodies). In strict mode with ES5 target, `function` declarations are only allowed at the top level of a script or function body—not inside blocks like `if`, `for`, or nested callbacks.

## Impact

**Symptoms**:
- `bun packages/paideia-backend/scripts/lint-project.ts` failed immediately with the above error
- Lint rules could not be executed
- No lint output produced

**Root Cause**:
- `linter.config.ts` is compiled by TypeScript (or tsgo) when the lint script runs
- The project's tsconfig (or default) targets ES5 or uses strict mode
- Functions like `visitForImport`, `countHooksInComponent`, `findDefaultExport` were declared with `function name() {}` inside blocks (e.g. inside `ts.forEachChild` callbacks, `if` branches)
- ES5 + strict mode disallows this pattern for historical/consistency reasons

## Resolution

**Fix**: Replace function declarations inside blocks with arrow function expressions.

```typescript
// ❌ Fails - function declaration inside block (e.g. inside ts.forEachChild callback)
ts.forEachChild(node, (n) => {
  function visit(child: ts.Node) {
    // ...
  }
  visit(n);
});

// ✅ Correct - arrow function
ts.forEachChild(node, (n) => {
  const visit = (child: ts.Node) => {
    // ...
  };
  visit(n);
});
```

**Functions updated in `linter.config.ts`**:
- `visitForImport`, `visitForExportFunction`, `visitForImports`, `visit`, `visitForHookDeclarations`
- `findDefaultExport` (2 places)
- `countHooksInComponent`, `countUseStateInComponent`, `collectActions`

## Prevention

**When writing code that may be compiled with strict mode and ES5 target**:
1. Avoid `function name() {}` inside blocks (`if`, `else`, `for`, `while`, callbacks)
2. Use `const name = () => {}` or `const name = function() {}` instead
3. Arrow functions and function expressions are allowed everywhere; only declarations are restricted

**Quick check**: If the function is inside `{ }` that is not the top-level of a file or the direct body of another function, use an expression form.

## References

- Changelog: `changelogs/0094-2026-03-02-bun-monorepo-restructure.md`
- Affected file: `packages/paideia-backend/linter.config.ts`
- Skill: `.cursor/skills/linter-config-typescript/SKILL.md`

## Status

✅ **RESOLVED** - All function declarations inside blocks replaced with arrow functions; lint-project runs successfully.
