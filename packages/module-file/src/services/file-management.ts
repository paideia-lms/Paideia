import { Result } from "typescript-result";
import { InvalidArgumentError, UnknownError } from "@paideia/shared";
import { transformError } from "../errors";
import { Files } from "../collections/files";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "@paideia/shared";
import { handleTransactionId } from "@paideia/shared";

export interface CreateFileArgs extends BaseInternalFunctionArgs {
	data: {
		title: string;
		description?: string;
		media?: (number | File)[];
		createdBy: number;
	};
}

export interface UpdateFileArgs extends BaseInternalFunctionArgs {
	fileId: number;
	data: {
		title?: string;
		description?: string;
		media?: (number | File)[];
	};
}

export interface FindFileByIdArgs extends BaseInternalFunctionArgs {
	fileId: number;
}

export interface SearchFilesArgs extends BaseInternalFunctionArgs {
	filters?: {
		createdBy?: number;
		title?: string;
		limit?: number;
		page?: number;
	};
}

export interface DeleteFileArgs extends BaseInternalFunctionArgs {
	fileId: number;
}

export interface FindFilesByUserArgs extends BaseInternalFunctionArgs {
	userId: number;
	limit?: number;
}

export function tryCreateFile(args: CreateFileArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				data: { title, description, media, createdBy },
				req,
				overrideAccess = false,
			} = args;

			if (!title || title.trim().length === 0) {
				throw new InvalidArgumentError("File title cannot be empty");
			}

			if (title.trim().length > 500) {
				throw new InvalidArgumentError("File title cannot exceed 500 characters");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newFile = await payload
					.create({
						collection: "files",
						data: {
							title: title.trim(),
							description: description?.trim(),
							media: media ?? [],
							createdBy,
						} as any,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return newFile;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create file", {
				cause: error,
			}),
	);
}

export function tryUpdateFile(args: UpdateFileArgs) {
	return Result.try(
		async () => {
			const { payload, fileId, data, req, overrideAccess = false } = args;

			if (data.title !== undefined) {
				if (!data.title || data.title.trim().length === 0) {
					throw new InvalidArgumentError("File title cannot be empty");
				}

				if (data.title.trim().length > 500) {
					throw new InvalidArgumentError("File title cannot exceed 500 characters");
				}
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const updatedFile = await payload
					.update({
						collection: "files",
						id: fileId,
						data: {
							...(data.title !== undefined ? { title: data.title.trim() } : {}),
							...(data.description !== undefined
								? { description: data.description?.trim() }
								: {}),
							...(data.media !== undefined
								? { media: data.media }
								: {}),
						} as any,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updatedFile;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update file", {
				cause: error,
			}),
	);
}

export function tryFindFileById(args: FindFileByIdArgs) {
	return Result.try(
		async () => {
			const { payload, fileId, req, overrideAccess = false } = args;

			const file = await payload
				.findByID({
					collection: Files.slug,
					id: fileId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return file;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find file by ID", {
				cause: error,
			}),
	);
}

export function trySearchFiles(args: SearchFilesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				filters = {},
				req,
				overrideAccess = false,
			} = args;

			const { createdBy, title, limit = 10, page = 1 } = filters;

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

			const files = await payload.find({
				collection: "files",
				where,
				limit,
				page,
				sort: "-createdAt",
				req,
				overrideAccess,
				depth: 1,
			}).then(stripDepth<1, "find">());

			return {
				docs: files.docs,
				totalDocs: files.totalDocs,
				totalPages: files.totalPages,
				page: files.page,
				limit: files.limit,
				hasNextPage: files.hasNextPage,
				hasPrevPage: files.hasPrevPage,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to search files", {
				cause: error,
			}),
	);
}

export function tryDeleteFile(args: DeleteFileArgs) {
	return Result.try(
		async () => {
			const { payload, fileId, req, overrideAccess = false } = args;

			const deletedFile = await payload.delete({
				collection: "files",
				id: fileId,
				req,
				overrideAccess,
				depth: 0,
			}).then(stripDepth<0, "delete">());

			return deletedFile;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete file", {
				cause: error,
			}),
	);
}

export function tryFindFilesByUser(args: FindFilesByUserArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				userId,
				limit = 10,
				req,
				overrideAccess = false,
			} = args;

			const files = await payload.find({
				collection: "files",
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

			return files.docs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find files by user", {
				cause: error,
			}),
	);
}
