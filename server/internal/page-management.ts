import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	NonExistingPageError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { tryParseMediaFromHtml } from "./utils/parse-media-from-html";

export type CreatePageArgs = BaseInternalFunctionArgs & {
	content?: string;
	userId: number;
};

export type UpdatePageArgs = BaseInternalFunctionArgs & {
	id: number;
	content?: string;
};

export type DeletePageArgs = BaseInternalFunctionArgs & {
	id: number;
};

export type GetPageByIdArgs = BaseInternalFunctionArgs & {
	id: number;
};

export const tryCreatePage = Result.wrap(
	async (args: CreatePageArgs) => {
		const {
			payload,
			content,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Parse media from HTML content
		const mediaParseResult = tryParseMediaFromHtml(content || "");

		if (!mediaParseResult.ok) {
			throw mediaParseResult.error;
		}

		const { ids: parsedIds, filenames } = mediaParseResult.value;

		// Resolve filenames to IDs in a single query
		let resolvedIds: number[] = [];
		if (filenames.length > 0) {
			try {
				const mediaResult = await payload.find({
					collection: "media",
					where: {
						filename: {
							in: filenames,
						},
					},
					limit: filenames.length,
					depth: 0,
					pagination: false,
					overrideAccess: true,
					req,
				});

				resolvedIds = mediaResult.docs.map((doc) => doc.id);
			} catch (error) {
				// If media lookup fails, log warning but continue
				console.warn(`Failed to resolve media filenames to IDs:`, error);
			}
		}

		// Combine parsed IDs and resolved IDs
		const mediaIds = [...parsedIds, ...resolvedIds];

		const page = await payload
			.create({
				collection: "pages",
				data: {
					content: content || "",
					createdBy: userId,
					media: mediaIds.length > 0 ? mediaIds : undefined,
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryUpdatePage: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		return page;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to create page"),
);

export const tryUpdatePage = Result.wrap(
	async (args: UpdatePageArgs) => {
		const {
			payload,
			id,
			content,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		// Check if page exists
		const existingPage = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingPage) {
			throw new NonExistingPageError("Page not found");
		}

		// Parse media from HTML content if content is provided
		let mediaIds: number[] = [];
		if (content !== undefined) {
			const mediaParseResult = tryParseMediaFromHtml(content || "");

			if (!mediaParseResult.ok) {
				throw mediaParseResult.error;
			}

			const { ids: parsedIds, filenames } = mediaParseResult.value;

			// Resolve filenames to IDs in a single query
			let resolvedIds: number[] = [];
			if (filenames.length > 0) {
				try {
					const mediaResult = await payload.find({
						collection: "media",
						where: {
							filename: {
								in: filenames,
							},
						},
						limit: filenames.length,
						depth: 0,
						pagination: false,
						overrideAccess: true,
						req:
							req && "transactionID" in req && req.transactionID
								? { transactionID: req.transactionID as string | number }
								: undefined,
					});

					resolvedIds = mediaResult.docs.map((doc) => doc.id);
				} catch (error) {
					// If media lookup fails, log warning but continue
					console.warn(`Failed to resolve media filenames to IDs:`, error);
				}
			}

			// Combine parsed IDs and resolved IDs
			mediaIds = [...parsedIds, ...resolvedIds];
		}

		const page = await payload
			.update({
				collection: "pages",
				id,
				data: {
					content,
					...(content !== undefined && {
						media: mediaIds.length > 0 ? mediaIds : [],
					}),
				},
				user,
				req,
				overrideAccess,
			})
			.then((r) => {
				const createdBy = r.createdBy;
				assertZodInternal(
					"tryUpdatePage: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				return {
					...r,
					createdBy,
				};
			});

		return page;
	},
	(error) => transformError(error) ?? new UnknownError("Failed to update page"),
);

export const tryDeletePage = Result.wrap(
	async (args: DeletePageArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		// Check if page exists
		const existingPage = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingPage) {
			throw new NonExistingPageError("Page not found");
		}

		await payload.delete({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		return { success: true };
	},
	(error) => transformError(error) ?? new UnknownError("Failed to delete page"),
);

export const tryGetPageById = Result.wrap(
	async (args: GetPageByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

		if (!id) {
			throw new InvalidArgumentError("Page ID is required");
		}

		const page = await payload.findByID({
			collection: "pages",
			id,
			user,
			req,
			overrideAccess,
		});

		if (!page) {
			throw new NonExistingPageError("Page not found");
		}

		return page;
	},
	(error) =>
		transformError(error) ?? new UnknownError("Failed to get page by ID"),
);
