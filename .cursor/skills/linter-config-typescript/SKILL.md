---
name: linter-config-typescript
description: Fix "Function declarations are not allowed inside blocks in strict mode when targeting ES5" in TypeScript files. Use when linter configs or TS compiler API code fail with this error.
---

# Linter Config and TypeScript Strict Mode

## When to Use

- Error: "Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'. Modules are automatically in strict mode."
- Code uses `function name() {}` inside `if`, `for`, callbacks, or other blocks
- Custom lint scripts or configs that use the TypeScript compiler API

## Cause

In strict mode with ES5 target, `function` **declarations** are only allowed at the top level of a script or the direct body of another function. They are **not** allowed inside blocks (e.g. `if`, `else`, `for`, `while`, or callback bodies).

## Solution

Replace function declarations with arrow functions or function expressions:

```typescript
// ❌ Fails
ts.forEachChild(node, (n) => {
  function visit(child: ts.Node) {
    // ...
  }
  visit(n);
});

// ✅ Correct
ts.forEachChild(node, (n) => {
  const visit = (child: ts.Node) => {
    // ...
  };
  visit(n);
});
```

## Checklist

1. Locate `function name() {}` inside blocks (not at top level)
2. Replace with `const name = () => {}` or `const name = function() {}`
3. Ensure the function is still invoked correctly (no change to call sites)
4. Run the script to verify: `bun packages/paideia-backend/scripts/lint-project.ts`

## Reference

- Incident report: `release-notes/incidents/2026-03-03-strict-mode-function-declarations-in-blocks.md`
