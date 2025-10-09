# Note Management API Changes

## Summary
Refactored all note management functions to use object-based arguments and explicit user authentication for better performance and clearer API.

## New API Signatures

### Before (Old API)
```typescript
tryCreateNote(payload, request, { content, createdBy }, overrideAccess)
tryUpdateNote(payload, request, noteId, { content }, overrideAccess)
tryFindNoteById(payload, noteId, request, overrideAccess)
trySearchNotes(payload, { filters }, request, overrideAccess)
tryDeleteNote(payload, request, noteId, overrideAccess)
tryFindNotesByUser(payload, userId, limit, request, overrideAccess)
```

### After (New API)
```typescript
tryCreateNote({ payload, data: { content, createdBy }, user, req, overrideAccess })
tryUpdateNote({ payload, noteId, data: { content }, user, req, overrideAccess })
tryFindNoteById({ payload, noteId, user, req, overrideAccess })
trySearchNotes({ payload, filters: { ... }, user, req, overrideAccess })
tryDeleteNote({ payload, noteId, user, req, overrideAccess })
tryFindNotesByUser({ payload, userId, limit, user, req, overrideAccess })
```

## Key Changes

1. **Object-based Arguments**: All functions now accept a single object parameter instead of positional arguments
2. **Explicit User Parameter**: `user` is now passed directly instead of being extracted from the request
3. **Performance**: Avoids redundant `payload.auth()` calls by accepting pre-authenticated user

## Usage Pattern

```typescript
// Get user from authentication
const authResult = await payload.auth({ headers: request.headers });
const user = authResult.user;

// Use authenticated user in operations
const note = await tryCreateNote({
  payload,
  data: { content: "My note", createdBy: userId },
  user,
  req: request,
  overrideAccess: false, // Enforce access control
});
```

## Migration Guide

### With overrideAccess (testing/admin operations)
```typescript
// Old
await tryCreateNote(payload, request, { content, createdBy }, true);

// New
await tryCreateNote({
  payload,
  data: { content, createdBy },
  overrideAccess: true,
});
```

### With access control (normal operations)
```typescript
// Old
await tryCreateNote(payload, request, { content, createdBy }, false);

// New
const authResult = await payload.auth({ headers: request.headers });
await tryCreateNote({
  payload,
  data: { content, createdBy },
  user: authResult.user,
  req: request,
  overrideAccess: false,
});
```




## Summary

Refactored all note management functions to use object-based arguments with explicit user authentication, improving performance and API clarity.

## Motivation

1. **Performance**: The previous implementation called `payload.auth()` internally on every request, even when the user was already authenticated. By accepting the `user` as a parameter, we avoid redundant authentication calls.

2. **Clarity**: Object-based arguments make the API more readable and self-documenting, especially for functions with many parameters.

3. **Flexibility**: Separating authentication from business logic gives callers more control over how and when authentication happens.

## Changes

### API Signature Changes

All note management functions now accept a single object parameter instead of positional arguments:

#### Before (Old API)
```typescript
tryCreateNote(payload, request, { content, createdBy }, overrideAccess)
tryUpdateNote(payload, request, noteId, { content }, overrideAccess)
tryFindNoteById(payload, noteId, request, overrideAccess)
trySearchNotes(payload, { filters }, request, overrideAccess)
tryDeleteNote(payload, request, noteId, overrideAccess)
tryFindNotesByUser(payload, userId, limit, request, overrideAccess)
```

#### After (New API)
```typescript
tryCreateNote({ payload, data: { content, createdBy }, user, req, overrideAccess })
tryUpdateNote({ payload, noteId, data: { content }, user, req, overrideAccess })
tryFindNoteById({ payload, noteId, user, req, overrideAccess })
trySearchNotes({ payload, filters: { ... }, user, req, overrideAccess })
tryDeleteNote({ payload, noteId, user, req, overrideAccess })
tryFindNotesByUser({ payload, userId, limit, user, req, overrideAccess })
```

### New Type Definitions

```typescript
export interface CreateNoteArgs {
  payload: Payload;
  data: {
    content: string;
    createdBy: number;
    isPublic?: boolean;
  };
  user?: TypedUser | null;
  req?: Request;
  overrideAccess?: boolean;
}

// Similar interfaces for UpdateNoteArgs, FindNoteByIdArgs, SearchNotesArgs, DeleteNoteArgs, FindNotesByUserArgs
```

### Authentication Pattern

The new pattern separates authentication from business logic:

```typescript
// Get authenticated user once
const authResult = await payload.auth({ headers: request.headers });
const user = authResult.user;

// Use authenticated user in multiple operations
await tryCreateNote({
  payload,
  data: { content: "My note", createdBy: userId },
  user,  // Pass pre-authenticated user
  overrideAccess: false,
});
```

## Migration Guide

### With overrideAccess (testing/admin operations)

```typescript
// Old
await tryCreateNote(payload, request, { content, createdBy }, true);

// New
await tryCreateNote({
  payload,
  data: { content, createdBy },
  overrideAccess: true,
});
```

### With access control (normal operations)

```typescript
// Old
await tryCreateNote(payload, request, { content, createdBy }, false);

// New
const authResult = await payload.auth({ headers: request.headers });
await tryCreateNote({
  payload,
  data: { content, createdBy },
  user: authResult.user,
  req: request,
  overrideAccess: false,
});
```

## Breaking Changes

⚠️ **All note management functions have changed their signatures.**

Projects using these functions must update their calls to use the new object-based API. The TypeScript compiler will catch these changes at compile time.

## Benefits

1. **Better Performance**: Avoids redundant `payload.auth()` calls by accepting pre-authenticated users
2. **Cleaner API**: Object parameters are more readable than long positional argument lists
3. **More Flexible**: Callers can control authentication flow and reuse authenticated users
4. **Type Safe**: All parameters are properly typed with dedicated interfaces

## Testing

- ✅ All existing tests updated to use new API
- ✅ Tests cover both `overrideAccess: true` and `overrideAccess: false` scenarios
- ✅ Access control behavior remains unchanged
- ✅ No linter errors

## Files Changed

- `server/internal/note-management.ts` - Function implementations
- `server/internal/note-management.test.ts` - All test cases updated

