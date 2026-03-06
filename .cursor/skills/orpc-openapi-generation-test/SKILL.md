---
name: orpc-openapi-generation-test
description: Test OpenAPI spec generation for oRPC procedures. Use when adding new API modules or ensuring paths/methods appear correctly in the generated OpenAPI spec.
---

# oRPC OpenAPI Generation Tests

## When to Use

- Adding new API procedures and ensuring they appear in the OpenAPI spec
- Verifying path params, HTTP methods, and route structure for new endpoints

## Pattern

1. Import the procedures from the API module.
2. Build a router object matching the structure used in `orpc/router.ts`.
3. Use `createOpenApiGenerator().generate(router, options)` to produce the spec.
4. Assert on `spec.paths` for expected paths and HTTP methods.

## Example

```typescript
import { describe, expect, test } from "bun:test";
import {
  getMediaById,
  getMediaByFilenames,
  deleteMedia,
  renameMedia,
} from "../api/media-management";
import { createOpenApiGenerator } from "../../../orpc/openapi-handler";

const mediaApiRouter = {
  media: {
    getById: getMediaById,
    getByFilenames: getMediaByFilenames,
    delete: deleteMedia,
    rename: renameMedia,
  },
};

describe("Media API OpenAPI generation", () => {
  test("should include media paths in generated OpenAPI spec", async () => {
    const openApiGenerator = createOpenApiGenerator();
    const spec = await openApiGenerator.generate(mediaApiRouter, {
      info: { title: "Paideia LMS API", version: "1.0.0" },
      servers: [{ url: "http://localhost:3001/openapi" }],
    });

    expect(spec).toBeDefined();
    expect(spec.openapi).toBeDefined();
    expect(spec.paths).toBeDefined();

    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/media/{id}"]).toBeDefined();
    expect(paths["/media/by-filenames"]).toBeDefined();
  });

  test("GET /media/{id} should have correct method and path params", async () => {
    const openApiGenerator = createOpenApiGenerator();
    const spec = await openApiGenerator.generate(mediaApiRouter, {
      info: { title: "Paideia LMS API", version: "1.0.0" },
      servers: [{ url: "http://localhost:3001/openapi" }],
    });

    const pathItem = (spec.paths as Record<string, unknown>)["/media/{id}"] as Record<string, unknown>;
    expect(pathItem).toBeDefined();
    expect(pathItem.get).toBeDefined();

    const getOp = pathItem.get as Record<string, unknown>;
    expect(getOp.parameters).toBeDefined();
    const params = getOp.parameters as Array<Record<string, unknown>>;
    const idParam = params.find((p) => p.name === "id");
    expect(idParam).toBeDefined();
    expect(idParam?.in).toBe("path");
  });

  test("DELETE /media/{id} should have delete method", async () => {
    const openApiGenerator = createOpenApiGenerator();
    const spec = await openApiGenerator.generate(mediaApiRouter, {
      info: { title: "Paideia LMS API", version: "1.0.0" },
      servers: [{ url: "http://localhost:3001/openapi" }],
    });

    const pathItem = (spec.paths as Record<string, unknown>)["/media/{id}"] as Record<string, unknown>;
    expect(pathItem).toBeDefined();
    expect(pathItem.delete).toBeDefined();
  });
});
```

## Notes

- Router structure must match how procedures are nested in `orpc/router.ts` (e.g. `media.getById` → `paths["/media/{id}"]`).
- Path strings in the spec use the route path (e.g. `/media/{id}`, `/media/by-filenames`, `/cron-jobs/pending/{queue}`).
- HTTP methods are lowercase on path items: `pathItem.get`, `pathItem.post`, `pathItem.delete`, `pathItem.patch`.
- Use `pathItem.get as Record<string, unknown>` for type-safe access when asserting on `parameters`.
- When adding new API procedures, add corresponding OpenAPI tests and register in `orpc/router.ts`.

## Reference

- User module: `packages/paideia-backend/src/modules/user/tests/openapi-generation.test.ts`
- Note module: `packages/paideia-backend/src/modules/note/tests/openapi-generation.test.ts`
- Infrastructure module: `packages/paideia-backend/src/modules/infrastructure/tests/openapi-generation.test.ts`
- OpenAPI handler: `packages/paideia-backend/src/orpc/openapi-handler.ts`
