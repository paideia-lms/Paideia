# Incident Report: typeCreateActionRpc submit() Does Not Return Action Data

**Date**: March 3, 2026  
**Severity**: Medium (causes UI bugs)  
**Affected**: Components using `typeCreateActionRpc` createHook's `submit()`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-008

## Summary

When using `typeCreateActionRpc`'s `createHook`, the `submit()` function does **not** return the action response data. Code that relies on `.then((data) => ...)` to read the action result will receive `undefined`, causing UI state (e.g. showing a newly generated API key) to never update.

## Impact

**Symptoms**:
- After calling an action (e.g. generate API key), the UI does not reflect the result
- State set in `.then((data) => setState(data.something))` never runs
- The action succeeds (e.g. notification shows) but component state is stale

**Root Cause**:
- `submit()` internally calls `fetcher.submit()` and awaits it, but does not return `fetcher.data`
- React Router's `useFetcher` stores the action result in `fetcher.data`, not as the promise resolution
- The hook exposes `data` separately; `submit()` returns `Promise<void>`

## Resolution

Use the `data` property from the hook and sync it to local state with `useEffect`:

```typescript
// ❌ Wrong - data is always undefined
const { submit: generate } = useGenerateApiKey();
const [generatedKey, setGeneratedKey] = useState<string | null>(null);

const handleGenerate = () => {
  generate({ params: {}, values: {} }).then((data) => {
    if (data?.apiKey) setGeneratedKey(data.apiKey);  // Never runs!
  });
};
```

```typescript
// ✅ Correct - use data from hook
const { submit: generate, data: generateData } = useGenerateApiKey();
const [generatedKey, setGeneratedKey] = useState<string | null>(null);

useEffect(() => {
  if (generateData?.status === StatusCode.Ok && "apiKey" in generateData && generateData.apiKey) {
    setGeneratedKey(generateData.apiKey);
  }
}, [generateData]);

const handleGenerate = () => {
  generate({ params: {}, values: {} });
};
```

## Pattern

1. Destructure `data` from the action hook: `const { submit, data } = useMyAction()`
2. Use `useEffect` to react to `data` changes and update local state
3. Call `submit()` without expecting a return value

## Prevention

- When an action returns data needed for UI (e.g. one-time secrets, created IDs), always use the hook's `data` + `useEffect`, never `submit().then()`
- See skill: `.cursor/skills/react-router-action-hook-data/SKILL.md`

## References

- Action utils: `apps/paideia/app/utils/router/action-utils.ts`
- Example (fixed): `apps/paideia/app/routes/user/api-keys.tsx`

## Status

✅ **RESOLVED** – Use `data` from the hook and `useEffect` to sync action results to component state.
