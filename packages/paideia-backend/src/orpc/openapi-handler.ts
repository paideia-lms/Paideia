import type { Payload } from "payload";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import {
	ZodToJsonSchemaConverter,
	experimental_ZodSmartCoercionPlugin as ZodSmartCoercionPlugin,
} from "@orpc/zod/zod4";
import type { OrpcContext } from "./context";
import type { orpcRouter } from "./router";

export function createOpenApiHandler(
	router: typeof orpcRouter,
	payload: Payload,
) {
	return new OpenAPIHandler(router, {
		plugins: [
			new CORSPlugin(),
			new ZodSmartCoercionPlugin(),
		],
		interceptors: [
			onError((error: unknown) => {
				payload.logger.error(`oRPC error: ${error}`);
			}),
		],
	});
}

const zodConverter = new ZodToJsonSchemaConverter();

/** Fallback for undefined/null schemas to avoid schema._zod errors in ZodToJsonSchemaConverter */
const fallbackSchemaConverter = {
	condition: (schema: unknown) =>
		schema == null || (typeof schema === "object" && !("_zod" in schema)),
	convert: (
		_schema: unknown,
	): [required: boolean, jsonSchema: { type: string; additionalProperties?: boolean }] =>
		[false, { type: "object", additionalProperties: true }],
};

export function createOpenApiGenerator() {
	return new OpenAPIGenerator({
		schemaConverters: [fallbackSchemaConverter, zodConverter],
	});
}

export function createScalarDocsHtml(specUrl: string): string {
	return `<!doctype html>
<html>
  <head>
    <title>Paideia LMS API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="https://orpc.dev/icon.svg" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${specUrl}',
      })
    </script>
  </body>
</html>`;
}
