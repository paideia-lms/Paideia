/**
 * Minimal OpenAPI generator for module-infrastructure tests.
 * For full Paideia OpenAPI, use paideia-backend's orpc/openapi-handler.
 */
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

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
