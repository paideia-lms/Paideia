# User Module

User management for Paideia LMS: authentication, registration, CRUD, impersonation, and API keys.

## Structure

```
modules/user/
├── MODULE.md
├── index.ts              # UserModule class (public facade)
├── collections/
│   └── users.ts          # Payload Users collection config
├── services/
│   └── user-management.ts # Internal try* functions (Result-based)
├── api/
│   └── user-management.ts # oRPC routes (findUserById, findUserByEmail, findAllUsers)
└── tests/
    └── user-management.test.ts
```

## Components

### Collections (`collections/users.ts`)

Payload collection config for `users`:

- **Auth**: email/password, `verify: true`, `useAPIKey: true`
- **Access**: read (all authenticated), create/update/delete (admin or self)
- **Fields**: email, firstName, lastName, role, bio, theme, direction, avatar
- **Roles**: admin, content-manager, analytics-viewer, instructor, student

Access rules respect `SANDBOX_MODE` and first-user admin protection.

### Services (`services/user-management.ts`)

Internal functions returning `Result<T, Error>`:

| Function | Purpose |
|----------|---------|
| `tryCreateUser` | Create user with optional avatar |
| `tryUpdateUser` | Update user profile |
| `tryDeleteUser` | Delete user |
| `tryFindUserById` | Find user by ID |
| `tryFindUserByEmail` | Find user by email |
| `tryFindAllUsers` | List users with pagination and search |
| `tryLogin` | Authenticate email/password |
| `tryRegisterFirstUser` | Register first admin |
| `tryRegisterUser` | Register new user |
| `tryHandleImpersonation` | Start/stop impersonation |
| `tryGetUserCount` | Count users |
| `tryGenerateApiKey` | Generate API key |
| `tryRevokeApiKey` | Revoke API key |
| `tryGetApiKeyStatus` | Check API key status |

### API (`api/user-management.ts`)

oRPC routes exposed as OpenAPI:

- `GET /users/{userId}` — find user by ID
- `GET /users/by-email` — find user by email
- `GET /users` — list users (limit, page, sort, query)

### UserModule (`index.ts`)

Class facade that injects `payload` and delegates to services:

```ts
const userModule = new UserModule(payload);
const result = await userModule.createUser({ data: {...}, req, overrideAccess: true });
```

## Integration

- **Paideia**: `paideia.ts` imports `userManagement` and exposes methods on `Paideia`
- **Index**: `tryCreateUser`, `Users` re-exported from `@paideia/paideia-backend`
- **Collections**: `Users` exported via `collections/index.ts`
- **oRPC**: `findUserById`, `findUserByEmail`, `findAllUsers` wired in `orpc/router.ts`
- **Seed**: `tryGetUserCount` used in `utils/db/seed.ts`
- **Tests**: Other modules use `tryCreateUser` for fixtures

## Dependencies

- `payload`, `typescript-result`
- `../errors` (transformError, UnknownError)
- `../internal/utils` (handleTransactionId, BaseInternalFunctionArgs, stripDepth)
- `../internal/media-management` (tryCreateMedia)
- `../payload-types` (User)

## Testing

`tests/user-management.test.ts` covers:

- CRUD operations
- Access control (admin vs regular user)
- Registration (first user, regular user)
- Impersonation
- API key generation, revocation, status
- User count

Uses `migrate:fresh` in `beforeAll` for a clean DB. Other modules import `tryCreateUser` for their own tests.
