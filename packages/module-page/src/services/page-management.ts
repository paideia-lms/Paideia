import { Result } from "typescript-result";
import { InvalidArgumentError, UnknownError } from "@paideia/shared";
import { transformError } from "../errors";
import { Pages } from "../collections/pages";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "@paideia/shared";
import { handleTransactionId } from "@paideia/shared";

export interface CreatePageArgs extends BaseInternalFunctionArgs {
	data: {
		title: string;
		description?: string;
		content?: string;
		createdBy: number;
	};
}

export interface UpdatePageArgs extends BaseInternalFunctionArgs {
	pageId: number;
	data: {
		title?: string;
		description?: string;
		content?: string;
	};
}

export interface FindPageByIdArgs extends BaseInternalFunctionArgs {
	pageId: number;
}

export interface SearchPagesArgs extends BaseInternalFunctionArgs {
	filters?: {
		createdBy?: number;
		title?: string;
		content?: string;
		limit?: number;
		page?: number;
	};
}

export interface DeletePageArgs extends BaseInternalFunctionArgs {
	pageId: number;
}

export interface FindPagesByUserArgs extends BaseInternalFunctionArgs {
	userId: number;
	limit?: number;
}

export function tryCreatePage(args: CreatePageArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				data: { title, description, content, createdBy },
				req,
				overrideAccess = false,
			} = args;

			if (!title || title.trim().length === 0) {
				throw new InvalidArgumentError("Page title cannot be empty");
			}

			if (title.trim().length > 500) {
				throw new InvalidArgumentError("Page title cannot exceed 500 characters");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newPage = await payload
					.create({
						collection: "pages",
						data: {
							title: title.trim(),
							description: description?.trim(),
							content: content?.trim(),
							createdBy,
						} as any,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return newPage;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create page", {
				cause: error,
			}),
	);
}

export function tryUpdatePage(args: UpdatePageArgs) {
	return Result.try(
		async () => {
			const { payload, pageId, data, req, overrideAccess = false } = args;

			if (data.title !== undefined) {
				if (!data.title || data.title.trim().length === 0) {
					throw new InvalidArgumentError("Page title cannot be empty");
				}

				if (data.title.trim().length > 500) {
					throw new InvalidArgumentError("Page title cannot exceed 500 characters");
				}
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const updatedPage = await payload
					.update({
						collection: "pages",
						id: pageId,
						data: {
							...(data.title !== undefined ? { title: data.title.trim() } : {}),
							...(data.description !== undefined
								? { description: data.description?.trim() }
								: {}),
							...(data.content !== undefined
								? { content: data.content?.trim() }
								: {}),
						} as any,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updatedPage;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update page", {
				cause: error,
			}),
	);
}

export function tryFindPageById(args: FindPageByIdArgs) {
	return Result.try(
		async () => {
			const { payload, pageId, req, overrideAccess = false } = args;

			const page = await payload
				.findByID({
					collection: Pages.slug,
					id: pageId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return page;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find page by ID", {
				cause: error,
			}),
	);
}

export function trySearchPages(args: SearchPagesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				filters = {},

				req,
				overrideAccess = false,
			} = args;

			const { createdBy, title, content, limit = 10, page = 1 } = filters;

			const where: Record<string, { equals?: number; contains?: string }> = {};

			if (createdBy) {
				where.createdBy = {
					equals: createdBy,
				};
			}

			if (title) {
				where.title = {
					contains: title,
				};
			}

			if (content) {
				where.content = {
					contains: content,
				};
			}

			const pages = await payload.find({
				collection: "pages",
				where,
				limit,
				page,
				sort: "-createdAt",
				req,
				overrideAccess,
			});

			return {
				docs: pages.docs,
				totalDocs: pages.totalDocs,
				totalPages: pages.totalPages,
				page: pages.page,
				limit: pages.limit,
				hasNextPage: pages.hasNextPage,
				hasPrevPage: pages.hasPrevPage,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to search pages", {
				cause: error,
			}),
	);
}

export function tryDeletePage(args: DeletePageArgs) {
	return Result.try(
		async () => {
			const { payload, pageId, req, overrideAccess = false } = args;

			const deletedPage = await payload.delete({
				collection: "pages",
				id: pageId,
				req,
				overrideAccess,
			});

			return deletedPage;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete page", {
				cause: error,
			}),
	);
}

export function tryFindPagesByUser(args: FindPagesByUserArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				userId,
				limit = 10,

				req,
				overrideAccess = false,
			} = args;

			const pages = await payload.find({
				collection: "pages",
				where: {
					createdBy: {
						equals: userId,
					},
				},
				limit,
				sort: "-createdAt",
				req,
				overrideAccess,
			});

			return pages.docs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find pages by user", {
				cause: error,
			}),
	);
}
