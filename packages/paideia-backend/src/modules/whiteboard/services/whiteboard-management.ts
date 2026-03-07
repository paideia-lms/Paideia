import { Whiteboards } from "server/collections";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "../../../errors";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "@paideia/shared";
import { handleTransactionId } from "@paideia/shared";

export interface CreateWhiteboardArgs extends BaseInternalFunctionArgs {
	data: {
		title: string;
		description?: string;
		content?: string;
		createdBy: number;
	};
}

export interface UpdateWhiteboardArgs extends BaseInternalFunctionArgs {
	whiteboardId: number;
	data: {
		title?: string;
		description?: string;
		content?: string;
	};
}

export interface FindWhiteboardByIdArgs extends BaseInternalFunctionArgs {
	whiteboardId: number;
}

export interface SearchWhiteboardsArgs extends BaseInternalFunctionArgs {
	filters?: {
		createdBy?: number;
		title?: string;
		content?: string;
		limit?: number;
		page?: number;
	};
}

export interface DeleteWhiteboardArgs extends BaseInternalFunctionArgs {
	whiteboardId: number;
}

export interface FindWhiteboardsByUserArgs extends BaseInternalFunctionArgs {
	userId: number;
	limit?: number;
}

export function tryCreateWhiteboard(args: CreateWhiteboardArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				data: { title, description, content, createdBy },
				req,
				overrideAccess = false,
			} = args;

			if (!title || title.trim().length === 0) {
				throw new InvalidArgumentError("Whiteboard title cannot be empty");
			}

			if (title.trim().length > 500) {
				throw new InvalidArgumentError("Whiteboard title cannot exceed 500 characters");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newWhiteboard = await payload
					.create({
						collection: "whiteboards",
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

				return newWhiteboard;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create whiteboard", {
				cause: error,
			}),
	);
}

export function tryUpdateWhiteboard(args: UpdateWhiteboardArgs) {
	return Result.try(
		async () => {
			const { payload, whiteboardId, data, req, overrideAccess = false } = args;

			if (data.title !== undefined) {
				if (!data.title || data.title.trim().length === 0) {
					throw new InvalidArgumentError("Whiteboard title cannot be empty");
				}

				if (data.title.trim().length > 500) {
					throw new InvalidArgumentError("Whiteboard title cannot exceed 500 characters");
				}
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const updatedWhiteboard = await payload
					.update({
						collection: "whiteboards",
						id: whiteboardId,
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

				return updatedWhiteboard;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update whiteboard", {
				cause: error,
			}),
	);
}

export function tryFindWhiteboardById(args: FindWhiteboardByIdArgs) {
	return Result.try(
		async () => {
			const { payload, whiteboardId, req, overrideAccess = false } = args;

			const whiteboard = await payload
				.findByID({
					collection: Whiteboards.slug,
					id: whiteboardId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return whiteboard;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find whiteboard by ID", {
				cause: error,
			}),
	);
}

export function trySearchWhiteboards(args: SearchWhiteboardsArgs) {
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

			const whiteboards = await payload.find({
				collection: "whiteboards",
				where,
				limit,
				page,
				sort: "-createdAt",
				req,
				overrideAccess,
				depth: 1,
			}).then(stripDepth<1, "find">());

			return {
				docs: whiteboards.docs,
				totalDocs: whiteboards.totalDocs,
				totalPages: whiteboards.totalPages,
				page: whiteboards.page,
				limit: whiteboards.limit,
				hasNextPage: whiteboards.hasNextPage,
				hasPrevPage: whiteboards.hasPrevPage,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to search whiteboards", {
				cause: error,
			}),
	);
}

export function tryDeleteWhiteboard(args: DeleteWhiteboardArgs) {
	return Result.try(
		async () => {
			const { payload, whiteboardId, req, overrideAccess = false } = args;

			const deletedWhiteboard = await payload.delete({
				collection: "whiteboards",
				id: whiteboardId,
				req,
				overrideAccess,
				depth: 0,
			}).then(stripDepth<0, "delete">());

			return deletedWhiteboard;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete whiteboard", {
				cause: error,
			}),
	);
}

export function tryFindWhiteboardsByUser(args: FindWhiteboardsByUserArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				userId,
				limit = 10,

				req,
				overrideAccess = false,
			} = args;

			const whiteboards = await payload.find({
				collection: "whiteboards",
				where: {
					createdBy: {
						equals: userId,
					},
				},
				limit,
				sort: "-createdAt",
				req,
				overrideAccess,
				depth: 1,
			}).then(stripDepth<1, "find">());

			return whiteboards.docs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find whiteboards by user", {
				cause: error,
			}),
	);
}
