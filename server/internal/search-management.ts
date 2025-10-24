import type { Payload, Where } from "payload";
import searchQueryParser from "search-query-parser";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import { transformError, UnknownError } from "~/utils/error";

const options = {
	keywords: ["in"],
};

const querySchema = z.object({
	text: z.string().or(z.string().array()).nullish(),
	in: z.array(z.string()).or(z.string()).nullish(),
});

export function parseQuery(query: string) {
	const result = searchQueryParser.parse(query ?? "test", options);

	if (typeof result === "string") {
		return { text: result, in: [] as string[] };
	}

	assertZodInternal("parseQuery: Result is required", result, querySchema);

	const _result = result as z.infer<typeof querySchema>;

	return {
		text: result.text,
		in: _result.in
			? Array.isArray(_result.in)
				? _result.in
				: [_result.in]
			: [],
	};
}

export interface SearchArgs {
	query?: string;
	limit?: number;
	page?: number;
}

export interface SearchResult {
	doc: {
		relationTo: string;
		value: {
			id: number;
		};
	};
	title?: string;
}

/**
 * Performs a global search across all searchable collections
 * Uses the Payload search plugin to find documents
 *
 *
 * search syntax:
 *
 * "John" -> will search for "John" in the whole search collection
 * "John" in:users -> will search for "John" in the users collection
 * "John" in:courses -> will search for "John" in the courses collection
 * "John" in:users,courses -> will search for "John" in the users and courses collections
 */
export const tryGlobalSearch = Result.wrap(
	async (payload: Payload, args: SearchArgs) => {
		const { query, limit = 10, page = 1 } = args;

		const { text, in: collections } = parseQuery(query ?? "");

		const where: Where = {};

		where.and = [
			{
				or: text
					? [
							{
								title: {
									contains: text,
								},
							},
							{
								meta: {
									contains: text,
								},
							},
						]
					: [],
			},
		];
		if (collections.length > 0) {
			where.and.push({
				or: collections.map((collection) => ({
					"doc.relationTo": {
						equals: collection,
					},
				})),
			});
		}

		const results = await payload.find({
			collection: "search",
			where,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: results.docs.map((doc) => ({
				...doc,
				meta: doc.meta ? JSON.parse(doc.meta) : null,
			})),
			totalDocs: results.totalDocs,
			totalPages: results.totalPages,
			page: results.page,
			limit: results.limit,
			hasNextPage: results.hasNextPage,
			hasPrevPage: results.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to search", {
			cause: error,
		}),
);
