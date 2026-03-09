# Collection Hook Transaction Visibility

**Date**: March 9, 2026  
**Severity**: High  
**Status**: Resolved  

## Problem

Payload collection hooks (`beforeValidate`, `beforeChange`, `afterChange`) that call `req.payload.findByID()`, `req.payload.find()`, or other Payload operations **without passing `req`** will execute those operations in a separate database connection. This breaks transaction isolation: entities created within the current transaction are invisible to the hook.

## Symptoms

- `NotFound` errors when looking up entities that were just created in the same transaction
- SeedBuilder tests fail for parent-child or hierarchical data
- Works fine without transactions (direct API calls) but fails inside `handleTransactionId()` / SeedBuilder wrappers

## Root Cause

Without `req`, Payload acquires a fresh connection from the PostgreSQL pool. Uncommitted writes within a transaction are only visible to the same connection.

## Fix

Always pass `req` to Payload operations inside hooks:

```typescript
// ❌ BROKEN
const parent = await req.payload.findByID({ collection: "groups", id: data.parent });

// ✅ FIXED
const parent = await req.payload.findByID({ collection: "groups", id: data.parent, req });
```

## Applies To

ALL Payload operations inside hooks: `findByID`, `find`, `create`, `update`, `delete`, `count`.

## Full Report

See `release-notes/incidents/2026-03-09-groups-hook-transaction-visibility.md`
