---
name: react-router-action-hook-data
description: Use action response data from typeCreateActionRpc hooks. Use when the UI needs to display or react to data returned by a server action (e.g. generated API key, created ID).
---

# React Router Action Hook: Getting Action Response Data

## When to Use

- A server action returns data the UI needs (e.g. one-time API key, created resource ID)
- You need to update component state based on the action result
- `submit().then((data) => ...)` does not work — `data` is always `undefined`

## Key Fact

The `submit()` from `typeCreateActionRpc`'s `createHook` does **not** return the action response. The response is stored in `fetcher.data`, which the hook exposes as `data`.

## Pattern

```typescript
const { submit: doAction, data: actionData } = useMyAction();
const [localState, setLocalState] = useState<SomeType | null>(null);

useEffect(() => {
  if (actionData?.status === StatusCode.Ok && "someField" in actionData) {
    setLocalState(actionData.someField);
  }
}, [actionData]);

const handleClick = () => {
  doAction({ params: {}, values: {} });
};
```

## Checklist

1. Destructure `data` from the hook (e.g. `data: generateData`)
2. Add `useEffect` that watches `data` and updates local state when the action succeeds
3. Call `submit()` without `.then()` — it returns `Promise<void>`
4. For multiple actions on the same route, each `createActionRpc` creates a separate hook with its own `data`

## Example

See `apps/paideia/app/routes/user/api-keys.tsx` — the generate API key flow uses `generateData` + `useEffect` to show the key after generation.

## Incident

- `release-notes/incidents/2026-03-03-action-hook-submit-does-not-return-data.md`
