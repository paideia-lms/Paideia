## Note Module

Self-contained Paideia module for note-taking. Depends on `@paideia/module-user` for the `createdBy` relationship.

### Scripts

- `bun run generate:payload` - Generate Payload types and DB schema (requires env vars)
- `bun run migrate:create` - Create a new migration
- `bun run typecheck` - Run TypeScript check
- `bun test src/tests` - Run tests

### Setup

Copy `.env.example` to `.env` and configure DATABASE_URL, PAYLOAD_SECRET, and S3 vars.